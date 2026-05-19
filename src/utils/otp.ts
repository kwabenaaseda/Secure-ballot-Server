// otp_manager.ts
import { randomBytes, timingSafeEqual } from "node:crypto";

// ---------- CONFIG ----------
const OTP_LENGTH = 5;
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OTP_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // or "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" for alphanumeric
const HASH_OTP_BEFORE_STORING = true; // recommended for production

// ---------- STORE ----------
// For production, replace with Redis/Postgres. Here an in‑memory store.
interface OTPEntry {
  hash: string;       // sha256 hash of the code if hashing; otherwise the raw code
  expires: number;    // timestamp
}
const otpStore = new Map<string, OTPEntry>();

// Cleanup expired entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of otpStore) {
    if (entry.expires <= now) otpStore.delete(key);
  }
}, 60_000).unref(); // don't keep the process alive

// ---------- HELPERS ----------
function generateCode(length: number, chars: string): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

async function hashString(str: string): Promise<string> {
  // Use SHA-256 via Web Crypto (available in Bun)
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------- PUBLIC API ----------

/**
 * Generates a new OTP for a given user identifier (e.g., userId or phone number).
 * Returns the plaintext code (for sending via SMS). The code is stored securely.
 */
export async function generateOTP(userIdentifier: string): Promise<string> {
  const code = generateCode(OTP_LENGTH, OTP_CHARS);

  if (HASH_OTP_BEFORE_STORING) {
    const hashed = await hashString(code);
    otpStore.set(userIdentifier, { hash: hashed, expires: Date.now() + OTP_TTL_MS });
  } else {
    otpStore.set(userIdentifier, { hash: code, expires: Date.now() + OTP_TTL_MS });
  }

  return code;
}

/**
 * Verifies the OTP entered by the user.
 * Returns `true` if the code matches and hasn't expired; removes the OTP afterwards.
 */
export async function verifyOTP(userIdentifier: string, code: string): Promise<boolean> {
  const entry = otpStore.get(userIdentifier);
  if (!entry) return false;

  // Check expiry
  if (Date.now() > entry.expires) {
    otpStore.delete(userIdentifier);
    return false;
  }

  let valid = false;
  if (HASH_OTP_BEFORE_STORING) {
    const hashedInput = await hashString(code);
    // Constant‑time comparison for safety
    valid = timingSafeEqual(Buffer.from(hashedInput), Buffer.from(entry.hash));
  } else {
    valid = timingSafeEqual(Buffer.from(code), Buffer.from(entry.hash));
  }

  // One‑time use: delete after verification (success or not)
  otpStore.delete(userIdentifier);
  return valid;
}