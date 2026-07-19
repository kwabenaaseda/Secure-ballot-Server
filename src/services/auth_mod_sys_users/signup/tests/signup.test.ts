import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import { randomUUID } from 'crypto';
import { AppDataSource } from "../../../../config/database";
import { Signup_Operation } from "../index";
import { User } from "../../../../entities/User";

// ─── SETUP ───────────────────────────────────────────
beforeAll(async () => {
  await AppDataSource.initialize();
});

afterAll(async () => {
  await AppDataSource.destroy();
});

afterEach(async () => {
  const repo = AppDataSource.getRepository(User);
  await repo.delete({ email: "test@secureballot.dev" });
  await repo.delete({ email: "duplicate@secureballot.dev" });
  await repo.delete({ username: "testuser_sb" });
  await repo.delete({ username: "different_user" });
  await repo.delete({ username: "different_user2" });
  await repo.delete({ telephone: "233000000001" });
  await repo.delete({ telephone: "233000000002" });
  await repo.delete({ telephone: "233000000003" });
});

// ─── MOCK NETWORK CONTEXT ──────────────────────────────
// Real requests get this from NetworkContextMiddleware. Tests call
// Signup_Operation directly, bypassing Express — so we build it by hand.
function mockNetwork() {
  return {
    ip_hash: "test-ip-hash",
    user_agent_class: "BROWSER" as const,
    correlation_id: randomUUID(),
    session_id: "NONE",
  };
}

// ─── BASE PAYLOAD ─────────────────────────────────────
const basePayload = {
  username: "testuser_sb",
  email: "test@secureballot.dev",
  telephone: "233000000001",
  password: "SecurePass123!",
  date_of_birth: "2000-01-01",
  nationality_code: "GH",
  occupation: "Engineer",
  network: mockNetwork(),
};

// ─── TESTS ────────────────────────────────────────────
describe("Signup_Operation", () => {

  // ── HAPPY PATH ──────────────────────────────────────
  it("creates a new user successfully", async () => {
    const result = await Signup_Operation({ ...basePayload, network: mockNetwork() });

    expect(result.success).toBe(true);
    expect(result._OPS_STATUS).toBe("COMPLETED");
    expect(result._OPS_MESSAGE).toBe("Signup successful. OTP sent to email and phone.");
  });

  it("returns a JWT token on success", async () => {
    const result = await Signup_Operation({ ...basePayload, network: mockNetwork() });

    expect(result.success).toBe(true);
    if (result.success) {
      const data = result._OPS_DATA as any;
      expect(data.token).toBeDefined();
      expect(typeof data.token).toBe("string");
      expect(data.token.split(".").length).toBe(3); // Valid JWT = 3 parts
    }
  });

  it("returns a refresh token on success", async () => {
    const result = await Signup_Operation({ ...basePayload, network: mockNetwork() });

    expect(result.success).toBe(true);
    if (result.success) {
      const data = result._OPS_DATA as any;
      expect(data.refresh_token).toBeDefined();
    }
  });

  it("returns user data without password hash", async () => {
    const result = await Signup_Operation({ ...basePayload, network: mockNetwork() });

    expect(result.success).toBe(true);
    if (result.success) {
      const data = result._OPS_DATA as any;
      expect(data.user.email).toBe(basePayload.email);
      expect(data.user.username).toBe(basePayload.username);
      expect(data.user.password_hash).toBeUndefined(); // Never expose hash
    }
  });

  it("sets verification_status to unverified on signup", async () => {
    const result = await Signup_Operation({ ...basePayload, network: mockNetwork() });

    expect(result.success).toBe(true);
    if (result.success) {
      const data = result._OPS_DATA as any;
      expect(data.user.verification_status).toBe("unverified");
    }
  });

  // ── DUPLICATE DETECTION ──────────────────────────────
  it("rejects duplicate email", async () => {
    await Signup_Operation({ ...basePayload, network: mockNetwork() }); // First signup

    const result = await Signup_Operation({
      ...basePayload,
      username: "different_user",
      telephone: "233000000002",
      network: mockNetwork(),
      // Same email ← should fail
    });

    expect(result.success).toBe(false);
    expect(result._OPS_MESSAGE).toContain("email");
  });

  it("rejects duplicate username", async () => {
    await Signup_Operation({ ...basePayload, network: mockNetwork() });

    const result = await Signup_Operation({
      ...basePayload,
      email: "duplicate@secureballot.dev",
      telephone: "233000000003",
      network: mockNetwork(),
      // Same username ← should fail
    });

    expect(result.success).toBe(false);
    expect(result._OPS_MESSAGE).toContain("username");
  });

  it("rejects duplicate telephone", async () => {
    await Signup_Operation({ ...basePayload, network: mockNetwork() });

    const result = await Signup_Operation({
      ...basePayload,
      email: "duplicate@secureballot.dev",
      username: "different_user2",
      network: mockNetwork(),
      // Same telephone ← should fail
    });

    expect(result.success).toBe(false);
    expect(result._OPS_MESSAGE).toContain("telephone");
  });

  // ── VALIDATION ───────────────────────────────────────
  it("rejects empty password", async () => {
    const result = await Signup_Operation({
      ...basePayload,
      password: "",
      network: mockNetwork(),
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing email", async () => {
    const result = await Signup_Operation({
      ...basePayload,
      email: "",
      network: mockNetwork(),
    });

    expect(result.success).toBe(false);
  });

  // ── DB VERIFICATION ──────────────────────────────────
  it("actually saves user to database", async () => {
    await Signup_Operation({ ...basePayload, network: mockNetwork() });

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneBy({ email: basePayload.email });

    expect(user).not.toBeNull();
    expect(user?.email).toBe(basePayload.email);
    expect(user?.username).toBe(basePayload.username);
  });

  it("stores hashed password, not plain text", async () => {
    await Signup_Operation({ ...basePayload, network: mockNetwork() });

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneBy({ email: basePayload.email });

    expect(user?.password_hash).not.toBe(basePayload.password);
    expect(user?.password_hash.startsWith("$2b$")).toBe(true); // bcrypt prefix
  });

});