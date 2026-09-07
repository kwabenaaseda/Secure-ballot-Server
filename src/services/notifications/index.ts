// src/services/notifications/index.ts
// In-app notification operations backing the client bell icon, plus the
// preference update behind the Settings toggles. All ops follow the standard
// Operations_Manager + Authorize + OPS envelope pattern.

import { Service_Error_Handler, Service_Success_Handler } from '../../types/Response_handler';
import { OPS_Success, OPS_Error } from '../../lib/ops/ops.factory';
import { AppDataSource } from '../../config/database';
import { Notification } from '../../entities/Notification';
import { User } from '../../entities/User';
import Operations_Manager, { Authorize } from '../../utils/ops.manager';
import { Log } from '../../utils/Logger';
import { NetworkContext } from '../../lib/ops/ops.types';
import { OrgMembers } from '../../entities/OrgMembers';

const SOURCE = 'Notifications_Operation';

function base(event: string, actorId: string, network: NetworkContext) {
  return {
    event,
    source: SOURCE,
    actor_type: 'VOTER' as const,
    actor_id: actorId,
    started_at: Date.now(),
    network,
    auth: { factors_used: ['JWT'], confidence: 1.0, mfa_verified: false },
    classification: 'INTERNAL' as const,
    integrity_class: 'STANDARD' as const,
  };
}

// ─── CREATE (internal helper, called by other services) ─────────────────────
// Best-effort: a notification failure must NEVER fail the triggering action,
// so this swallows and logs. Respects the user's approval-updates preference
// for JOIN_* events; election events respect notify_election_reminders.
export async function CreateNotification(input: {
  user_id: string;
  type: string;
  title: string;
  body: string;
  link?: string;
}): Promise<void> {
  try {
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: input.user_id },
      select: ['id', 'notify_approval_updates', 'notify_election_reminders'],
    });
    if (!user) return;
    if (input.type.startsWith('JOIN_') && !user.notify_approval_updates) return;
    if (input.type.startsWith('ELECTION_') && !user.notify_election_reminders) return;

    const repo = AppDataSource.getRepository(Notification);
    await repo.insert(
      repo.create({
        user_id: input.user_id,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link ?? null,
      }),
    );
  } catch (error) {
    Log.debug(SOURCE, `CreateNotification failed: ${String(error)}`, 'NOTIFICATION_CREATE');
  }
}

// ─── FAN-OUT (internal helper) ───────────────────────────────────────────────
// Creates the same notification for every ACTIVE member of an org, skipping
// the actor. Fire-and-forget: callers `void` this after commit.
export async function NotifyOrgMembers(
  orgId: string,
  notification: { type: string; title: string; body: string; link?: string },
  excludeUserId?: string,
): Promise<void> {
  try {
    const members = await AppDataSource.getRepository(OrgMembers).find({
      where: { org: { id: orgId }, status: 'active' },
      relations: ['user'],
      select: { user: { id: true } },
    });
    await Promise.all(
      members
        .filter((m) => m.user.id !== excludeUserId)
        .map((m) => CreateNotification({ user_id: m.user.id, ...notification })),
    );
  } catch (error) {
    Log.debug(SOURCE, `NotifyOrgMembers failed: ${String(error)}`, 'NOTIFICATION_FANOUT');
  }
}

// ─── LIST (paged, newest first) ──────────────────────────────────────────────
export async function ListNotifications_Operation(payload: {
  userId: string;
  network: NetworkContext;
  limit?: number;
}): Promise<Service_Success_Handler | Service_Error_Handler> {
  const started_at = Date.now();
  const ops_base = base('NOTIFICATIONS_LIST', payload.userId, payload.network);

  try {
    const limit = Math.min(Math.max(payload.limit ?? 30, 1), 100);
    const repo = AppDataSource.getRepository(Notification);
    const [items, unread] = await Promise.all([
      repo.find({
        where: { user_id: payload.userId },
        order: { created_at: 'DESC' },
        take: limit,
      }),
      repo.count({ where: { user_id: payload.userId, is_read: false } }),
    ]);

    return await OPS_Success({
      ...ops_base,
      started_at,
      status: 'COMPLETED',
      message: 'Notifications retrieved.',
      data: {
        unread_count: unread,
        notifications: items.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          link: n.link,
          is_read: n.is_read,
          created_at: n.created_at,
        })),
      },
    });
  } catch (error) {
    Log.debug(SOURCE, String(error), 'NOTIFICATIONS_LIST');
    return await OPS_Error({
      ...ops_base,
      started_at,
      status: 'SYSTEM_FAILURE',
      message: 'Failed to load notifications.',
      error_code: 'INTERNAL_ERROR',
      error_category: 'SYSTEM',
      retryable: true,
      retry_after_ms: 5000,
      stack_ref: `NOTIFICATIONS_LIST_${started_at}`,
    });
  }
}

// ─── MARK ONE READ ───────────────────────────────────────────────────────────
export async function MarkNotificationRead_Operation(payload: {
  userId: string;
  notificationId: string;
  network: NetworkContext;
}): Promise<Service_Success_Handler | Service_Error_Handler> {
  const started_at = Date.now();
  const ops_base = base('NOTIFICATION_MARK_READ', payload.userId, payload.network);

  try {
    const repo = AppDataSource.getRepository(Notification);
    const row = await repo.findOneBy({ id: payload.notificationId, user_id: payload.userId });
    if (!row) {
      return await OPS_Error({
        ...ops_base,
        started_at,
        status: 'OPERATION_FAILURE',
        message: 'Notification not found.',
        error_code: 'NOT_FOUND',
        error_category: 'VALIDATION',
        retryable: false,
      });
    }
    row.is_read = true;
    await repo.save(row);

    return await OPS_Success({
      ...ops_base,
      started_at,
      status: 'COMPLETED',
      message: 'Notification marked as read.',
      data: { id: row.id },
    });
  } catch (error) {
    Log.debug(SOURCE, String(error), 'NOTIFICATION_MARK_READ');
    return await OPS_Error({
      ...ops_base,
      started_at,
      status: 'SYSTEM_FAILURE',
      message: 'Failed to update notification.',
      error_code: 'INTERNAL_ERROR',
      error_category: 'SYSTEM',
      retryable: true,
      retry_after_ms: 5000,
      stack_ref: `NOTIFICATION_MARK_READ_${started_at}`,
    });
  }
}

// ─── MARK ALL READ ───────────────────────────────────────────────────────────
export async function MarkAllNotificationsRead_Operation(payload: {
  userId: string;
  network: NetworkContext;
}): Promise<Service_Success_Handler | Service_Error_Handler> {
  const started_at = Date.now();
  const ops_base = base('NOTIFICATIONS_MARK_ALL_READ', payload.userId, payload.network);

  try {
    const repo = AppDataSource.getRepository(Notification);
    await repo.update({ user_id: payload.userId, is_read: false }, { is_read: true });

    return await OPS_Success({
      ...ops_base,
      started_at,
      status: 'COMPLETED',
      message: 'All notifications marked as read.',
      data: {},
    });
  } catch (error) {
    Log.debug(SOURCE, String(error), 'NOTIFICATIONS_MARK_ALL_READ');
    return await OPS_Error({
      ...ops_base,
      started_at,
      status: 'SYSTEM_FAILURE',
      message: 'Failed to update notifications.',
      error_code: 'INTERNAL_ERROR',
      error_category: 'SYSTEM',
      retryable: true,
      retry_after_ms: 5000,
      stack_ref: `NOTIFICATIONS_MARK_ALL_${started_at}`,
    });
  }
}

// ─── UPDATE PREFERENCES (Settings toggles) ───────────────────────────────────
export async function UpdateNotificationPrefs_Operation(payload: {
  userId: string;
  network: NetworkContext;
  notify_election_reminders?: boolean;
  notify_approval_updates?: boolean;
}): Promise<Service_Success_Handler | Service_Error_Handler> {
  const started_at = Date.now();
  const ops_base = base('NOTIFICATION_PREFS_UPDATE', payload.userId, payload.network);

  try {
    const ops = await Operations_Manager({ user_id: payload.userId, location: 'domestic' });
    if (ops === false || !Authorize(ops.role, 'account.self', 'update')) {
      return await OPS_Error({
        ...ops_base,
        started_at,
        status: 'OPERATION_FAILURE',
        message: 'Not authorized.',
        error_code: 'FORBIDDEN',
        error_category: 'AUTH',
        retryable: false,
      });
    }

    const repo = AppDataSource.getRepository(User);
    const user = await repo.findOneBy({ id: payload.userId });
    if (!user) {
      return await OPS_Error({
        ...ops_base,
        started_at,
        status: 'OPERATION_FAILURE',
        message: 'User not found.',
        error_code: 'USER_NOT_FOUND',
        error_category: 'VALIDATION',
        retryable: false,
      });
    }

    if (typeof payload.notify_election_reminders === 'boolean') {
      user.notify_election_reminders = payload.notify_election_reminders;
    }
    if (typeof payload.notify_approval_updates === 'boolean') {
      user.notify_approval_updates = payload.notify_approval_updates;
    }
    await repo.save(user);

    return await OPS_Success({
      ...ops_base,
      started_at,
      status: 'COMPLETED',
      message: 'Notification preferences updated.',
      data: {
        notify_election_reminders: user.notify_election_reminders,
        notify_approval_updates: user.notify_approval_updates,
      },
    });
  } catch (error) {
    Log.debug(SOURCE, String(error), 'NOTIFICATION_PREFS_UPDATE');
    return await OPS_Error({
      ...ops_base,
      started_at,
      status: 'SYSTEM_FAILURE',
      message: 'Failed to update notification preferences.',
      error_code: 'INTERNAL_ERROR',
      error_category: 'SYSTEM',
      retryable: true,
      retry_after_ms: 5000,
      stack_ref: `NOTIFICATION_PREFS_${started_at}`,
    });
  }
}
