// ─── REQUIRED ENVIRONMENT VARIABLES ─────────────────
// Add any new env var here when you need it.
// The validator will enforce it on startup.

const REQUIRED_ENV_VARS = [
  // Server
  "PORT",
  "NODE_ENV",
  "JWT_SECRET",
  "JWT_EXPIRATION",
  'JWT_REFRESH_EXPIRATION',
  "API_URL",

  // Database
  "DATABASE_HOST",
  "DATABASE_PORT",
  "DATABASE_USERNAME",
  "DATABASE_PASSWORD",
  "DATABASE_NAME",

  // Email
  "RESEND_API_KEY",
  "MAIL_FROM",

  // SMS (comment out until Arkesel is ready)
   "ARKESEL_API_KEY",
   "ARKESEL_SENDER_ID",
] as const;

// ─── TYPE: VALID ENV KEY ─────────────────────────────
type EnvKey = (typeof REQUIRED_ENV_VARS)[number];

// ─── VALIDATE ────────────────────────────────────────
export function VALIDATE_ENV(): void {
  const missing: string[] = [];

  for (const key of REQUIRED_ENV_VARS) {
    const value = process.env[key];
    if (!value || value.trim() === "") {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    console.error("─────────────────────────────────────────");
    console.error("❌ MISSING REQUIRED ENVIRONMENT VARIABLES:");
    missing.forEach((key) => console.error(`   → ${key}`));
    console.error("─────────────────────────────────────────");
    console.error("Server cannot start. Add missing variables to .env");
    process.exit(1); // Crash immediately. Fail fast.
  }

  console.log("✅ Environment variables validated.");
}

// ─── GET ENV VAR (TYPE-SAFE, NO ASSERTION NEEDED) ────
// Use this anywhere instead of process.env.SOMETHING
// It GUARANTEES the value exists (validated at startup)
export function ENV(key: EnvKey): string {
  return process.env[key] as string;
}