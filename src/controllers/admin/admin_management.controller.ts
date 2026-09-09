import { Request, Response } from 'express';
import {
  ListUsers_Operation,
  SetUserStatus_Operation,
  ListOrganizations_Operation,
  ListAuditLogs_Operation,
  GetAuditLogStats_Operation,
} from '../../services/admin_management/admin_management';
import {
  ApproveOrganization_Operation,
  RejectOrganization_Operation,
  SuspendOrganization_Operation,
} from '../../services/admin_management/admin_org_management';

export async function ListUsers_Controller(req: Request, res: Response) {
  const result = await ListUsers_Operation({
    admin_id: req.user!.id,
    network: req.networkContext!,
    verification_status: req.query.verification_status as any,
  });
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result._OPS_MESSAGE,
    });
  }

  return res.status(201).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA,
  });
}

export async function SetUserStatus_Controller(req: Request, res: Response) {
  const result = await SetUserStatus_Operation({
    admin_id: req.user!.id,
    network: req.networkContext!,
    user_id: req.params.id,
    user_status: req.body.user_status,
  });
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result._OPS_MESSAGE,
    });
  }

  return res.status(201).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA,
  });
}

export async function ListOrganizations_Controller(req: Request, res: Response) {
  const result = await ListOrganizations_Operation({
    admin_id: req.user!.id,
    network: req.networkContext!,
    limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
  });
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result._OPS_MESSAGE,
    });
  }

  return res.status(201).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA,
  });
}

export async function ApproveOrganization_Controller(req: Request, res: Response) {
  const result = await ApproveOrganization_Operation({
    admin_id: req.user!.id,
    network: req.networkContext!,
    org_id: req.params.id,
  });
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result._OPS_MESSAGE,
    });
  }

  return res.status(201).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA,
  });
}

export async function RejectOrganization_Controller(req: Request, res: Response) {
  const result = await RejectOrganization_Operation({
    admin_id: req.user!.id,
    network: req.networkContext!,
    org_id: req.params.id,
    reason: req.body.reason,
  });
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result._OPS_MESSAGE,
    });
  }

  return res.status(201).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA,
  });
}

export async function SuspendOrganization_Controller(req: Request, res: Response) {
  const result = await SuspendOrganization_Operation({
    admin_id: req.user!.id,
    network: req.networkContext!,
    org_id: req.params.id,
    reason: req.body.reason,
  });
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result._OPS_MESSAGE,
    });
  }

  return res.status(201).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA,
  });
}

// ─── AUDIT LOG CONTROLLERS ──────────────────────────────────────────────────

export async function ListAuditLogs_Controller(req: Request, res: Response) {
  const result = await ListAuditLogs_Operation({
    admin_id: req.user!.id,
    network: req.networkContext!,
    limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    actor_type: req.query.actor_type as string | undefined,
    event: req.query.event as string | undefined,
    success: req.query.success !== undefined ? req.query.success === 'true' : undefined,
  });
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result._OPS_MESSAGE,
    });
  }

  return res.status(200).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA,
  });
}

export async function GetAuditLogStats_Controller(req: Request, res: Response) {
  const result = await GetAuditLogStats_Operation({
    admin_id: req.user!.id,
    network: req.networkContext!,
  });
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result._OPS_MESSAGE,
    });
  }

  return res.status(200).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA,
  });
}
