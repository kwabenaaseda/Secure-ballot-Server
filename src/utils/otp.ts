// src/utils/otp.ts — same exported signatures, no other file needs to change
import { createHash, timingSafeEqual } from 'node:crypto';
import { AppDataSource } from '../config/database';
import { OtpCode } from '../entities/OtpCode';

const OTP_LENGTH = 5;
// 10 minutes — matches what the OTP and password-reset email/SMS copy tells
// users. The server was the outlier at 5 (Tier 2.2 fix).
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(length: number, chars: string): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

function hashString(str: string): string {
  return createHash('sha256').update(str).digest('hex');
}

export async function generateOTP(userIdentifier: string): Promise<string> {
  const code = generateCode(OTP_LENGTH, OTP_CHARS);
  const hash = hashString(code);

  // Use atomic upsert to avoid race conditions
  // First delete any existing code, then insert the new one in a single transaction
  await AppDataSource.transaction(async (manager) => {
    const repo = manager.getRepository(OtpCode);
    // Delete any existing codes for this user
    const existing = await repo.findOne({ where: { user_identifier: userIdentifier } });
    if (existing) {
      console.log(`[OTP] Deleting existing code for user_identifier: ${userIdentifier}`);
      await repo.delete({ user_identifier: userIdentifier });
    }
    // Insert new code
    await repo.save(
      repo.create({
        user_identifier: userIdentifier,
        code_hash: hash,
        expires_at: new Date(Date.now() + OTP_TTL_MS),
      })
    );
  });

  console.log(`[OTP] Generated code for user_identifier: ${userIdentifier}, code: ${code}`);
  return code;
}

export async function verifyOTP(userIdentifier: string, code: string): Promise<boolean> {
  const repo = AppDataSource.getRepository(OtpCode);
  const entry = await repo.findOne({ where: { user_identifier: userIdentifier } });
  if (!entry) {
    console.log(`[OTP] No entry found for user_identifier: ${userIdentifier}`);
    return false;
  }

  if (Date.now() > entry.expires_at.getTime()) {
    console.log(`[OTP] Code expired for user_identifier: ${userIdentifier}`);
    await repo.delete({ id: entry.id });
    return false;
  }

  const hashedInput = hashString(code);
  const valid =
    hashedInput.length === entry.code_hash.length &&
    timingSafeEqual(Buffer.from(hashedInput), Buffer.from(entry.code_hash));

  if (valid) {
    // Only delete on successful verification (one-time use)
    await repo.delete({ id: entry.id });
    console.log(`[OTP] Code verified successfully for user_identifier: ${userIdentifier}`);
  } else {
    console.log(`[OTP] Code mismatch for user_identifier: ${userIdentifier}`);
    console.log(`[OTP] Input code: ${code}`);
    console.log(`[OTP] Input hash: ${hashedInput}`);
    console.log(`[OTP] Stored hash: ${entry.code_hash}`);
  }

  return valid;
}
