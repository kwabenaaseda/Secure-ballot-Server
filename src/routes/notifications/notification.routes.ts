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

/**
 * @swagger
 * tags:
 *   - name: Notifications
 *     description: Notification list and preference endpoints
 */

Notification_routes.use(AuthMiddleware, NetworkContextMiddleware);

const prefsSchema = z.object({
  notify_election_reminders: z.boolean().optional(),
  notify_approval_updates: z.boolean().optional(),
});

// GET /notifications -- list (newest first) + unread count
/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: List notifications (newest first) with unread count
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Notifications list.
 */
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
/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     summary: Mark a notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Notification marked as read.
 */
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
/**
 * @swagger
 * /notifications/read-all:
 *   post:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read.
 */
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
/**
 * @swagger
 * /notifications/preferences:
 *   patch:
 *     summary: Update notification preferences
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NotificationPrefsRequest'
 *     responses:
 *       200:
 *         description: Preferences updated.
 *       400:
 *         description: Invalid input.
 */
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
