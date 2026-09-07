// src/services/organization_management/upload_roster/index.ts
// POST /org/:orgId/roster — org-admin uploads an authoritative member roster
// (CSV exported from their existing membership records / database). The CSV
// header row is mapped onto the org's custom_fields schema: an 'email'
// column (case-insensitive) feeds roster email matching, every other column
// matches a custom_field by key or label. Join requests from a user whose
// account email matches an unclaimed roster row are auto-activated.
//
// Modes: 'replace' wipes unclaimed rows and re-imports (claimed rows —
// already-matched members — are never touched). 'append' adds rows, skipping
// emails already on the roster.

import { Service_Error_Handler, Service_Success_Handler } from '../../../types/Response_handler';
import { OPS_Success, OPS_Error } from '../../../lib/ops/ops.factory';
import { Log } from '../../../utils/Logger';
import { AppDataSource } from '../../../config/database';
import { OrgMembers } from '../../../entities/OrgMembers';
import { OrganizationAuth } from '../../../entities/Org_auth';
import { OrgRoster } from '../../../entities/OrgRoster';
import { NetworkContext } from '../../../lib/ops/ops.types';
import Operations_Manager, { Authorize } from '../../../utils/ops.manager';

const SOURCE = 'UploadRoster_Operation';

// RFC-4180 subset: quoted fields, escaped quotes, CRLF.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field.trim());
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field.trim());
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field.trim());
  if (row.length > 1 || row[0] !== '') rows.push(row);
  return rows;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
}

export async function UploadRoster_Operation(payload: {
  orgId: string;
  actorId: string;
  csv: string;
  mode?: 'replace' | 'append';
  network: NetworkContext;
}): Promise<Service_Success_Handler | Service_Error_Handler> {
  const started_at = Date.now();
  const ops_base = {
    event: 'ORG_ROSTER_UPLOAD',
    source: SOURCE,
    actor_type: 'ORG_ADMIN' as const,
    actor_id: payload.actorId,
    started_at,
    network: payload.network,
    auth: { factors_used: ['JWT'], confidence: 1.0, mfa_verified: false },
    classification: 'INTERNAL' as const,
    integrity_class: 'SENSITIVE' as const,
    org_id: payload.orgId,
  };
  const mode = payload.mode === 'append' ? 'append' : 'replace';

  try {
    // Tier gate (role matrix) + row-level active-admin check.
    const ops = await Operations_Manager({
      user_id: payload.actorId,
      org_id: payload.orgId,
      location: 'organization',
    });
    if (ops === false || !Authorize(ops.role, 'org_membership', 'verify_join_request')) {
      return await OPS_Error({
        ...ops_base,
        started_at,
        status: 'OPERATION_FAILURE',
        message: 'Not authorized to manage the member roster.',
        error_code: 'FORBIDDEN',
        error_category: 'AUTH',
        retryable: false,
      });
    }
    const actor = await AppDataSource.getRepository(OrgMembers).findOne({
      where: { org: { id: payload.orgId }, user: { id: payload.actorId } },
    });
    if (!actor || actor.status !== 'active' || actor.role !== 'admin') {
      return await OPS_Error({
        ...ops_base,
        started_at,
        status: 'OPERATION_FAILURE',
        message: 'Only active org admins can upload the member roster.',
        error_code: 'NOT_AUTHORIZED',
        error_category: 'AUTH',
        retryable: false,
      });
    }

    const auth = await AppDataSource.getRepository(OrganizationAuth).findOne({
      where: { org: { id: payload.orgId } },
    });
    const customFields = ((auth?.custom_fields as any[]) ?? []) as Array<{
      key: string;
      label: string;
      required?: boolean;
    }>;

    const parsed = parseCsv(payload.csv ?? '');
    if (parsed.length < 2) {
      return await OPS_Error({
        ...ops_base,
        started_at,
        status: 'OPERATION_FAILURE',
        message: 'CSV must contain a header row and at least one data row.',
        error_code: 'CSV_EMPTY',
        error_category: 'VALIDATION',
        retryable: true,
      });
    }
    const [headers, ...dataRows] = parsed;

    // Map each CSV column to 'email', a custom_field key, or null (ignored).
    const columnMap: Array<{
      target: 'email' | 'field' | null;
      key?: string;
      required?: boolean;
    }> = headers.map((h) => {
      const n = normalizeHeader(h);
      if (n === 'email' || n === 'e mail' || n === 'email address') {
        return { target: 'email' as const };
      }
      const field = customFields.find(
        (f) => normalizeHeader(f.key) === n || normalizeHeader(f.label ?? '') === n,
      );
      return field
        ? { target: 'field' as const, key: field.key, required: field.required }
        : { target: null };
    });

    const emailIdx = columnMap.findIndex((c) => c.target === 'email');
    if (emailIdx === -1) {
      return await OPS_Error({
        ...ops_base,
        started_at,
        status: 'OPERATION_FAILURE',
        message: 'CSV needs an "email" column so roster rows can be matched to joining accounts.',
        error_code: 'EMAIL_COLUMN_MISSING',
        error_category: 'VALIDATION',
        retryable: true,
      });
    }
    const coveredKeys = new Set(columnMap.filter((c) => c.target === 'field').map((c) => c.key));
    const unmappedRequired = customFields.filter((f) => f.required && !coveredKeys.has(f.key));

    const rosterRepo = AppDataSource.getRepository(OrgRoster);
    const existing = await rosterRepo.find({ where: { org: { id: payload.orgId } } });
    const existingEmails = new Set(
      existing.map((r) => r.email).filter((e): e is string => e !== null),
    );

    const toInsert: Array<{
      org: { id: string };
      email: string;
      custom_data: Record<string, any>;
    }> = [];
    let skippedDuplicates = 0;
    let skippedInvalid = 0;

    for (const row of dataRows) {
      const rawEmail = (row[emailIdx] ?? '').toLowerCase();
      if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
        skippedInvalid++;
        continue;
      }
      if (existingEmails.has(rawEmail)) {
        skippedDuplicates++;
        continue;
      }
      existingEmails.add(rawEmail); // dedupe within the file itself

      const customData: Record<string, any> = {};
      let missingRequired = false;
      columnMap.forEach((c, idx) => {
        if (c.target !== 'field' || !c.key) return;
        const value = row[idx] ?? '';
        if (c.required && !value) missingRequired = true;
        customData[c.key] = value;
      });
      if (missingRequired) {
        skippedInvalid++;
        continue;
      }
      toInsert.push({ org: { id: payload.orgId }, email: rawEmail, custom_data: customData });
    }

    if (toInsert.length === 0) {
      return await OPS_Error({
        ...ops_base,
        started_at,
        status: 'OPERATION_FAILURE',
        message: 'No valid roster rows found in the uploaded file.',
        error_code: 'NO_VALID_ROWS',
        error_category: 'VALIDATION',
        retryable: true,
      });
    }

    await AppDataSource.transaction(async (manager) => {
      if (mode === 'replace') {
        // Never delete claimed rows — those are matched, activated members.
        await manager
          .createQueryBuilder()
          .delete()
          .from(OrgRoster)
          .where('org_id = :orgId AND status = :status', {
            orgId: payload.orgId,
            status: 'unclaimed',
          })
          .execute();
      }
      for (const entry of toInsert) {
        await manager.save(manager.create(OrgRoster, entry));
      }
    });

    Log.info(
      SOURCE,
      'Roster ' + mode + ': ' + toInsert.length + ' rows imported for org ' + payload.orgId,
      'ORG_ROSTER_UPLOAD',
    );

    return await OPS_Success({
      ...ops_base,
      started_at,
      status: 'COMPLETED',
      message: 'Roster imported: ' + toInsert.length + ' members added.',
      data: {
        imported: toInsert.length,
        mode,
        skipped_duplicates: skippedDuplicates,
        skipped_invalid: skippedInvalid,
        unmapped_required_fields: unmappedRequired.map((f) => f.label ?? f.key),
      },
    });
  } catch (error) {
    Log.debug(SOURCE, String(error), 'ORG_ROSTER_UPLOAD');
    return await OPS_Error({
      ...ops_base,
      started_at,
      status: 'SYSTEM_FAILURE',
      message: 'An unexpected error occurred during ORG_ROSTER_UPLOAD.',
      error_code: 'INTERNAL_ERROR',
      error_category: 'SYSTEM',
      retryable: true,
      retry_after_ms: 5000,
      stack_ref: 'ORG_ROSTER_UPLOAD_' + started_at,
    });
  }
}

// Roster summary for the admin dashboard.
export async function GetRosterSummary_Operation(payload: {
  orgId: string;
  actorId: string;
  network: NetworkContext;
}): Promise<Service_Success_Handler | Service_Error_Handler> {
  const started_at = Date.now();
  const ops_base = {
    event: 'ORG_ROSTER_SUMMARY',
    source: SOURCE,
    actor_type: 'ORG_ADMIN' as const,
    actor_id: payload.actorId,
    started_at,
    network: payload.network,
    auth: { factors_used: ['JWT'], confidence: 1.0, mfa_verified: false },
    classification: 'INTERNAL' as const,
    integrity_class: 'SENSITIVE' as const,
    org_id: payload.orgId,
  };

  try {
    const ops = await Operations_Manager({
      user_id: payload.actorId,
      org_id: payload.orgId,
      location: 'organization',
    });
    if (ops === false || !Authorize(ops.role, 'org_membership', 'verify_join_request')) {
      return await OPS_Error({
        ...ops_base,
        started_at,
        status: 'OPERATION_FAILURE',
        message: 'Not authorized to view the member roster.',
        error_code: 'FORBIDDEN',
        error_category: 'AUTH',
        retryable: false,
      });
    }

    const [total, unclaimed] = await Promise.all([
      AppDataSource.getRepository(OrgRoster).count({ where: { org: { id: payload.orgId } } }),
      AppDataSource.getRepository(OrgRoster).count({
        where: { org: { id: payload.orgId }, status: 'unclaimed' },
      }),
    ]);

    return await OPS_Success({
      ...ops_base,
      started_at,
      status: 'COMPLETED',
      message: 'Roster summary loaded.',
      data: { total, unclaimed, claimed: total - unclaimed },
    });
  } catch (error) {
    Log.debug(SOURCE, String(error), 'ORG_ROSTER_SUMMARY');
    return await OPS_Error({
      ...ops_base,
      started_at,
      status: 'SYSTEM_FAILURE',
      message: 'An unexpected error occurred while loading the roster summary.',
      error_code: 'INTERNAL_ERROR',
      error_category: 'SYSTEM',
      retryable: true,
      stack_ref: 'ORG_ROSTER_SUMMARY_' + started_at,
    });
  }
}
