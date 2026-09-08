import { Request, Response } from 'express';
//import { z } from 'zod';
import { CreateOrganization_Operation } from '../../services/organization_management/create_organization';
import { SearchOrganizations_Operation } from '../../services/organization/search';
import { GetOrgDetail_Operation } from '../../services/organization/get_detail';
import { CreateOrgPayloadStrict } from '../../services/organization_management/create_organization/types';
import { JoinOrganization_Operation } from '../../services/organization/join';
import { VerifyOrgCode_Operation } from '../../services/organization/verify_code';
import {
  ListMembers_Operation,
  UpdateMemberRole_Operation,
  UpdateMemberStatus_Operation,
} from '../../services/organization_management/member_management';
import { DeleteOrganization_Operation } from '../../services/organization_management/delete_organization';
import {
  ListPendingJoinRequests_Operation,
  DecideJoinRequest_Operation,
} from '../../services/organization_management/approve_join';
import {
  UploadRoster_Operation,
  GetRosterSummary_Operation,
} from '../../services/organization_management/upload_roster';


/* const CreateOrganizationSchema = z.object({
  name: z.string().min(2).max(120),
  sector: z.string().min(2).max(80),
  email: z.string().email(),
  company_logo: z.string().url().optional(),
  visibility: z.enum(['private', 'public']).default('private'),
}); */

export async function CreateOrganization_Controller(req: Request, res: Response) {
  const network = req.networkContext;
  if (!network) {
    return res.status(400).json({ success: false, message: 'Invalid User' });
  }

  //const parsed = CreateOrganizationSchema.safeParse(req.body);
  const parsed = CreateOrgPayloadStrict.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Invalid input',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const creator_id = req.user?.id;
  if (!creator_id) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const result = await CreateOrganization_Operation({
    ...parsed.data,
    creator_id,
    network,
    // Placeholder until real auth-factor propagation exists — see types.ts note
    auth: { factors_used: ['JWT'], confidence: 1.0, mfa_verified: false },
  });

  if (!result.success) {
    return res.status(400).json({ success: false, message: result._OPS_MESSAGE });
  }

  return res.status(201).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA,
  });
}

export async function Search_Org(req: Request, res: Response) {
  const network = req.networkContext;
  const query = (req.query.q as string) ?? '';
  if (!network) {
    return res.status(400).json({ success: false, message: 'Invalid User' });
  }
  // allow empty query to mean "list all" (the operation will cap results)

  const result = await SearchOrganizations_Operation({ query, network });
  if (!result.success) {
    return res.status(400).json({ success: false, message: result._OPS_MESSAGE });
  }

  return res.status(201).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA,
  });
}

export async function Get_Org_Detail(req: Request, res: Response) {
  const network = req.networkContext;
  const userId = req.user?.id;
  const { orgId } = req.params;
  if (!network || !userId) {
    return res.status(400).json({ success: false, message: 'Invalid User' });
  }
  if (!orgId) {
    return res.status(400).json({ success: false, message: 'Invalid Input' });
  }

  const result = await GetOrgDetail_Operation({ orgId, userId, network });
  if (!result.success) {
    return res.status(400).json({ success: false, message: result._OPS_MESSAGE });
  }

  return res.status(201).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA,
  });
}

// ─── OPEN ORG SESSION ───────────────────────────────────────────────────────
export async function OpenOrgSession_Controller(req: Request, res: Response) {
  const network = req.networkContext;
  const userId = req.user?.id;
  const { orgId } = req.params;
  if (!network || !userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  if (!orgId) {
    return res.status(400).json({ success: false, message: 'Invalid Input' });
  }

  const { OpenOrgSession_Operation } = await import('../../services/organization/open_session');
  const result = await OpenOrgSession_Operation({ orgId, userId, network });
  if (!result.success) {
    return res.status(400).json({ success: false, message: result._OPS_MESSAGE });
  }

  return res.status(200).json({ success: true, message: result._OPS_MESSAGE, data: result._OPS_DATA });
}
// ─── JOIN ORGANIZATION ─────────────────────────────────────────────────────────
export async function JoinOrganization_Controller(req: Request, res: Response) {
  const network = req.networkContext;
  const userId = req.user?.id;
  const { orgId } = req.params;

  if (!network || !userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  if (!orgId) {
    return res.status(400).json({ success: false, message: 'Invalid Input' });
  }

  const submitted_data =
    req.body && typeof req.body.submitted_data === 'object' && req.body.submitted_data !== null
      ? (req.body.submitted_data as Record<string, any>)
      : undefined;

  const result = await JoinOrganization_Operation({ orgId, userId, submitted_data, network });
  if (!result.success) {
    return res.status(400).json({ success: false, message: result._OPS_MESSAGE });
  }

  return res.status(200).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA,
  });
}

export async function VerifyOrgCode_Controller(req: Request, res: Response) {
  const network = req.networkContext;
  const userId = req.user?.id;
  const { orgId } = req.params;

  if (!network || !userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  if (!orgId || typeof req.body?.code !== 'string') {
    return res.status(400).json({ success: false, message: 'Passcode is required.' });
  }

  const result = await VerifyOrgCode_Operation({ orgId, userId, code: req.body.code, network });
  if (!result.success) {
    return res.status(400).json({ success: false, message: result._OPS_MESSAGE });
  }

  return res.status(200).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA,
  });
}

// ─── ORG MEMBER MANAGEMENT ─────────────────────────────────────────────────────
export async function ListOrgMembers_Controller(req: Request, res: Response) {
  const network = req.networkContext;
  const actorId = req.user?.id;
  const { orgId } = req.params;

  if (!network || !actorId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  if (!orgId) {
    return res.status(400).json({ success: false, message: 'Invalid Input' });
  }

  const result = await ListMembers_Operation({ orgId, actorId, network });
  if (!result.success) {
    return res.status(400).json({ success: false, message: result._OPS_MESSAGE });
  }

  return res.status(200).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA,
  });
}

export async function UpdateMemberRole_Controller(req: Request, res: Response) {
  const network = req.networkContext;
  const actorId = req.user?.id;
  const { orgId, memberId } = req.params;
  const { role } = req.body ?? {};

  if (!network || !actorId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  if (!orgId || !memberId) {
    return res.status(400).json({ success: false, message: 'Invalid Input' });
  }
  if (!['voter', 'moderator', 'admin'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role.' });
  }

  const result = await UpdateMemberRole_Operation({ orgId, memberId, actorId, role, network });
  if (!result.success) {
    return res.status(400).json({ success: false, message: result._OPS_MESSAGE });
  }

  return res.status(200).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA,
  });
}

export async function UpdateMemberStatus_Controller(req: Request, res: Response) {
  const network = req.networkContext;
  const actorId = req.user?.id;
  const { orgId, memberId } = req.params;
  const { status } = req.body ?? {};

  if (!network || !actorId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  if (!orgId || !memberId) {
    return res.status(400).json({ success: false, message: 'Invalid Input' });
  }
  if (!['active', 'deactivated'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status.' });
  }

  const result = await UpdateMemberStatus_Operation({ orgId, memberId, actorId, status, network });
  if (!result.success) {
    return res.status(400).json({ success: false, message: result._OPS_MESSAGE });
  }

  return res.status(200).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA,
  });
}

// ─── JOIN REQUESTS ─────────────────────────────────────────────────────────────
export async function ListPendingJoinRequests_Controller(req: Request, res: Response) {
  const network = req.networkContext;
  const actorId = req.user?.id;
  const { orgId } = req.params;

  if (!network || !actorId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  if (!orgId) {
    return res.status(400).json({ success: false, message: 'Invalid Input' });
  }

  const result = await ListPendingJoinRequests_Operation({ orgId, actorId, network });
  if (!result.success) {
    return res.status(400).json({ success: false, message: result._OPS_MESSAGE });
  }

  return res.status(200).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA,
  });
}

export async function ApproveJoinRequest_Controller(req: Request, res: Response) {
  const network = req.networkContext;
  const actorId = req.user?.id;
  const { orgId, memberId } = req.params;

  if (!network || !actorId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  if (!orgId || !memberId) {
    return res.status(400).json({ success: false, message: 'Invalid Input' });
  }

  const result = await DecideJoinRequest_Operation({ orgId, memberId, actorId, decision: 'approve', network });
  if (!result.success) {
    return res.status(400).json({ success: false, message: result._OPS_MESSAGE });
  }

  return res.status(200).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA,
  });
}

export async function DenyJoinRequest_Controller(req: Request, res: Response) {
  const network = req.networkContext;
  const actorId = req.user?.id;
  const { orgId, memberId } = req.params;

  if (!network || !actorId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  if (!orgId || !memberId) {
    return res.status(400).json({ success: false, message: 'Invalid Input' });
  }

  const result = await DecideJoinRequest_Operation({ orgId, memberId, actorId, decision: 'deny', network });
  if (!result.success) {
    return res.status(400).json({ success: false, message: result._OPS_MESSAGE });
  }

  return res.status(200).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA,
  });
}

// ─── MEMBER ROSTER (BYOI import) ───────────────────────────────────────────────
export async function UploadRoster_Controller(req: Request, res: Response) {
  const network = req.networkContext;
  const actorId = req.user?.id;
  const { orgId } = req.params;

  if (!network || !actorId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  if (!orgId) {
    return res.status(400).json({ success: false, message: 'Invalid Input' });
  }
  const csv = typeof req.body?.csv === 'string' ? req.body.csv : '';
  const mode = req.body?.mode === 'append' ? 'append' : 'replace';
  if (!csv.trim()) {
    return res.status(400).json({ success: false, message: 'CSV content is required.' });
  }

  const result = await UploadRoster_Operation({ orgId, actorId, csv, mode, network });
  if (!result.success) {
    return res.status(400).json({ success: false, message: result._OPS_MESSAGE });
  }

  return res.status(200).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA,
  });
}

export async function GetRosterSummary_Controller(req: Request, res: Response) {
  const network = req.networkContext;
  const actorId = req.user?.id;
  const { orgId } = req.params;

  if (!network || !actorId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  if (!orgId) {
    return res.status(400).json({ success: false, message: 'Invalid Input' });
  }

  const result = await GetRosterSummary_Operation({ orgId, actorId, network });
  if (!result.success) {
    return res.status(400).json({ success: false, message: result._OPS_MESSAGE });
  }

  return res.status(200).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA,
  });
}

export async function DeleteOrganization_Controller(req: Request, res: Response) {
  const network = req.networkContext;
  const actorId = req.user?.id;
  const { orgId } = req.params;

  if (!network || !actorId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  if (!orgId) {
    return res.status(400).json({ success: false, message: 'Invalid Input' });
  }

  const result = await DeleteOrganization_Operation({ orgId, actorId, network });
  if (!result.success) {
    return res.status(400).json({ success: false, message: result._OPS_MESSAGE });
  }

  return res.status(200).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA,
  });
}
