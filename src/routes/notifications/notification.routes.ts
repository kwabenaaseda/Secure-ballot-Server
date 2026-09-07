import Router from 'express';
import { z } from 'zod';
import { AuthMiddleware } from '../../middleware/auth.middleware';
import { NetworkContextMiddleware } from '../../middleware/networkContext';
import {
  ListNotifications_Operation,
  MarkNotificationRead_Operation,
  MarkAllNotificationsRead_Operation,
  UpdateNotificationPrefs_Operation,
} from '../../services/notifications';

const Notification_routes = Router();

Notification_routes.use(AuthMiddleware, NetworkContextMiddleware);

const prefsSchema = z.object({
  notify_election_reminders: z.boolean().optional(),
  notify_approval_updates: z.boolean().optional(),
});

// GET /notifications -- list (newest first) + unread count
Notification_routes.get('/', async (req, res) => {
  try {
    const result = await ListNotifications_Operation({
      userId: req.user!.id,
      network: req.networkContext!,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    if (!result.success) {
      return res.status(400).json({ success: false, message: result._OPS_MESSAGE });
    }
    return res.status(200).json({ success: true, message: result._OPS_MESSAGE, data: result._OPS_DATA });
  } catch {
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// PATCH /notifications/:id/read
Notification_routes.patch('/:id/read', async (req, res) => {
  try {
    const result = await MarkNotificationRead_Operation({
      userId: req.user!.id,
      notificationId: req.params.id,
      network: req.networkContext!,
    });
    if (!result.success) {
      return res.status(400).json({ success: false, message: result._OPS_MESSAGE });
    }
    return res.status(200).json({ success: true, message: result._OPS_MESSAGE, data: result._OPS_DATA });
  } catch {
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// POST /notifications/read-all
Notification_routes.post('/read-all', async (req, res) => {
  try {
    const result = await MarkAllNotificationsRead_Operation({
      userId: req.user!.id,
      network: req.networkContext!,
    });
    if (!result.success) {
      return res.status(400).json({ success: false, message: result._OPS_MESSAGE });
    }
    return res.status(200).json({ success: true, message: result._OPS_MESSAGE, data: result._OPS_DATA });
  } catch {
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// PATCH /notifications/preferences -- Settings toggles
Notification_routes.patch('/preferences', async (req, res) => {
  try {
    const parsed = prefsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Invalid input.' });
    }
    const result = await UpdateNotificationPrefs_Operation({
      userId: req.user!.id,
      network: req.networkContext!,
      ...parsed.data,
    });
    if (!result.success) {
      return res.status(400).json({ success: false, message: result._OPS_MESSAGE });
    }
    return res.status(200).json({ success: true, message: result._OPS_MESSAGE, data: result._OPS_DATA });
  } catch {
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

export default Notification_routes;
