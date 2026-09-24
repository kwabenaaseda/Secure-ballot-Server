import Router from 'express';
import { AuthMiddleware } from '../../middleware/auth.middleware';
import { NetworkContextMiddleware } from '../../middleware/networkContext';
import { z } from 'zod';
import { AppDataSource } from '../../config/database';
import { BiometricCredential } from '../../entities/BiometricCredential';
import { BiometricRegistrationStart_Operation } from '../../services/biometric/register/start';
import { BiometricRegistrationFinish_Operation } from '../../services/biometric/register/finish';
import { BiometricAuthenticationStart_Operation } from '../../services/biometric/authenticate/start';
import { BiometricAuthenticationFinish_Operation } from '../../services/biometric/authenticate/finish';

const Biometric_routes = Router();

/**
 * @swagger
 * tags:
 *   - name: Biometric
 *     description: WebAuthn registration and step-up endpoints
 */

Biometric_routes.use(AuthMiddleware, NetworkContextMiddleware);

const registrationFinishSchema = z.object({
  response: z.record(z.any()),
  device_name: z.string().max(80).optional(),
});

const authenticationStartSchema = z.object({
  purpose: z.enum(['VOTE', 'ACCOUNT_MUTATE']),
  resource_id: z.string().uuid().optional(),
});

const authenticationFinishSchema = z.object({
  response: z.record(z.any()),
  purpose: z.enum(['VOTE', 'ACCOUNT_MUTATE']),
  resource_id: z.string().uuid().optional(),
});

// POST /biometric/register/start -- issue a registration challenge
/**
 * @swagger
 * /biometric/register/start:
 *   post:
 *     summary: Start WebAuthn registration (issue challenge)
 *     tags: [Biometric]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Registration challenge issued.
 */
Biometric_routes.post('/register/start', async (req, res) => {
  try {
    const userId = req.user!.id;
    const result = await BiometricRegistrationStart_Operation({
      userId,
      network: req.networkContext!,
    });
    if (!result.success) {
      return res.status(400).json({ success: false, message: result._OPS_MESSAGE });
    }
    return res.status(200).json({ success: true, message: result._OPS_MESSAGE, data: result._OPS_DATA });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// POST /biometric/register/finish -- verify attestation, store credential
/**
 * @swagger
 * /biometric/register/finish:
 *   post:
 *     summary: Finish WebAuthn registration (store credential)
 *     tags: [Biometric]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BiometricRegisterFinishRequest'
 *     responses:
 *       200:
 *         description: Credential stored.
 *       400:
 *         description: Invalid input.
 */
Biometric_routes.post('/register/finish', async (req, res) => {
  try {
    const parsed = registrationFinishSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Invalid input.' });
    }
    const userId = req.user!.id;
    const result = await BiometricRegistrationFinish_Operation({
      userId,
      response: parsed.data.response as any,
      deviceName: parsed.data.device_name,
      network: req.networkContext!,
    });
    if (!result.success) {
      return res.status(400).json({ success: false, message: result._OPS_MESSAGE });
    }
    return res.status(200).json({ success: true, message: result._OPS_MESSAGE, data: result._OPS_DATA });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// POST /biometric/authenticate/start -- issue an authentication challenge (step-up)
/**
 * @swagger
 * /biometric/authenticate/start:
 *   post:
 *     summary: Start WebAuthn step-up authentication (issue challenge)
 *     tags: [Biometric]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BiometricAuthStartRequest'
 *     responses:
 *       200:
 *         description: Authentication challenge issued.
 *       400:
 *         description: Invalid input.
 */
Biometric_routes.post('/authenticate/start', async (req, res) => {
  try {
    const parsed = authenticationStartSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Invalid input.' });
    }
    const userId = req.user!.id;
    const result = await BiometricAuthenticationStart_Operation({
      userId,
      purpose: parsed.data.purpose,
      resourceId: parsed.data.resource_id,
      network: req.networkContext!,
    });
    if (!result.success) {
      return res.status(400).json({ success: false, message: result._OPS_MESSAGE });
    }
    return res.status(200).json({ success: true, message: result._OPS_MESSAGE, data: result._OPS_DATA });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// POST /biometric/authenticate/finish -- verify assertion, issue step-up token
/**
 * @swagger
 * /biometric/authenticate/finish:
 *   post:
 *     summary: Finish WebAuthn step-up authentication (issue step-up token)
 *     tags: [Biometric]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BiometricAuthFinishRequest'
 *     responses:
 *       200:
 *         description: Step-up token issued.
 *       400:
 *         description: Invalid input.
 */
Biometric_routes.post('/authenticate/finish', async (req, res) => {
  try {
    const parsed = authenticationFinishSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Invalid input.' });
    }
    const userId = req.user!.id;
    const result = await BiometricAuthenticationFinish_Operation({
      userId,
      response: parsed.data.response as any,
      purpose: parsed.data.purpose,
      resourceId: parsed.data.resource_id,
      network: req.networkContext!,
    });
    if (!result.success) {
      return res.status(400).json({ success: false, message: result._OPS_MESSAGE });
    }
    return res.status(200).json({ success: true, message: result._OPS_MESSAGE, data: result._OPS_DATA });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

export default Biometric_routes;

// GET /biometric/devices -- list enrolled credentials for the authenticated user
/**
 * @swagger
 * /biometric/devices:
 *   get:
 *     summary: List enrolled biometric devices
 *     tags: [Biometric]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Enrolled devices retrieved.
 */
Biometric_routes.get('/devices', async (req, res) => {
  try {
    const userId = req.user!.id;
    const credRepo = AppDataSource.getRepository(BiometricCredential);
    const devices = await credRepo.find({
      where: { user_id: userId },
      select: ['id', 'device_name', 'created_at'],
      order: { created_at: 'DESC' },
    });
    return res.status(200).json({
      success: true,
      message: 'Enrolled devices retrieved.',
      data: { devices },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// DELETE /biometric/devices/:id -- remove an enrolled credential
/**
 * @swagger
 * /biometric/devices/{id}:
 *   delete:
 *     summary: Remove an enrolled biometric credential
 *     tags: [Biometric]
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
 *         description: Biometric credential removed.
 *       404:
 *         description: Credential not found.
 */
Biometric_routes.delete('/devices/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
    const credentialId = req.params.id;

    const credRepo = AppDataSource.getRepository(BiometricCredential);
    const result = await credRepo.delete({ id: credentialId, user_id: userId });

    if (result.affected === 0) {
      return res.status(404).json({
        success: false,
        message: 'Credential not found or does not belong to the authenticated user.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Biometric credential removed successfully.',
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});
