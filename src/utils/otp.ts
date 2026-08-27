// src/utils/otp.ts — same exported signatures, no other file needs to change
import { timingSafeEqual } from "node:crypto";
import { AppDataSource } from "../config/database";
import { OtpCode } from "../entities/OtpCode";

const OTP_LENGTH = 5;
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(length: number, chars: string): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

async function hashString(str: string): Promise<string> {
  const data = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function generateOTP(userIdentifier: string): Promise<string> {
  const code = generateCode(OTP_LENGTH, OTP_CHARS);
  const hash = await hashString(code);
  const repo = AppDataSource.getRepository(OtpCode);

  // One active code per identifier — same semantics as the old Map.set overwrite.
  await repo.delete({ user_identifier: userIdentifier });
  await repo.save(repo.create({ user_identifier: userIdentifier, code_hash: hash, expires_at: new Date(Date.now() + OTP_TTL_MS) }));

  return code;
}

export async function verifyOTP(userIdentifier: string, code: string): Promise<boolean> {
  const repo = AppDataSource.getRepository(OtpCode);
  const entry = await repo.findOne({ where: { user_identifier: userIdentifier } });
  if (!entry) return false;

  if (Date.now() > entry.expires_at.getTime()) {
    await repo.delete({ id: entry.id });
    return false;
  }

  const hashedInput = await hashString(code);
  const valid = hashedInput.length === entry.code_hash.length &&
    timingSafeEqual(Buffer.from(hashedInput), Buffer.from(entry.code_hash));

  await repo.delete({ id: entry.id }); // one-time use, same as before
  return valid;
}