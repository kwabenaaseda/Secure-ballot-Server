import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { AppDataSource } from "../../../../config/database";
import { Login_Operation } from "../index";
import { User } from "../../../../entities/User";
import { Signup_Operation } from '../../signup';

// ─── SETUP ───────────────────────────────────────────
beforeAll(async () => {
  await AppDataSource.initialize();
});

afterAll(async () => {
  await AppDataSource.destroy();
});

// ─── TEST USER ────────────────────────────────────────
const TEST_USER = {
  username: "test_login_user",
  email: "login_test@secureballot.dev",
  telephone: "233000000099",
  password: "securepass123",
  date_of_birth: "2000-01-01",
  nationality_code: "GH",
  occupation: "Engineer",
};

beforeEach(async () => {
  await Signup_Operation(TEST_USER);
});

afterEach(async () => {
  const repo = AppDataSource.getRepository(User);
  await repo.delete({ email: "login_test@secureballot.dev" });
  await repo.delete({ username: "test_login_user" });
  await repo.delete({ telephone: "233000000099" });
});

// ─── TESTS ────────────────────────────────────────────
describe("Login_Operation", () => {

  // ── HAPPY PATH ──────────────────────────────────────
  it("logs in successfully with email", async () => {
    const result = await Login_Operation({
      identifier: TEST_USER.email,
      password: TEST_USER.password,
    });
    expect(result.success).toBe(true);
    expect(result._OPS_MESSAGE).toBe("LOGIN SUCCESSFUL");
  });

  it("logs in successfully with username", async () => {
    const result = await Login_Operation({
      identifier: TEST_USER.username,
      password: TEST_USER.password,
    });
    expect(result.success).toBe(true);
    expect(result._OPS_MESSAGE).toBe("LOGIN SUCCESSFUL");
  });

  it("returns a valid JWT token on success", async () => {
    const result = await Login_Operation({
      identifier: TEST_USER.email,
      password: TEST_USER.password,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const data = result._OPS_DATA as any;
      expect(data.token).toBeDefined();
      expect(data.token.split(".").length).toBe(3); // Valid JWT = 3 parts
    }
  });

  it("returns a refresh token on success", async () => {
    const result = await Login_Operation({
      identifier: TEST_USER.email,
      password: TEST_USER.password,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const data = result._OPS_DATA as any;
      expect(data.refresh_token).toBeDefined();
      expect(data.refresh_token.split(".").length).toBe(3);
    }
  });

  it("returns user data on success", async () => {
    const result = await Login_Operation({
      identifier: TEST_USER.email,
      password: TEST_USER.password,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const data = result._OPS_DATA as any;
      expect(data.user.email).toBe(TEST_USER.email);
      expect(data.user.username).toBe(TEST_USER.username);
      expect(data.user.password_hash).toBeUndefined(); // Never expose hash
    }
  });

  // ── FAILURE CASES ────────────────────────────────────
  it("rejects wrong password", async () => {
    const result = await Login_Operation({
      identifier: TEST_USER.email,
      password: "wrongpassword",
    });
    expect(result.success).toBe(false);
    expect(result._OPS_MESSAGE).toBe("Invalid credentials.");
  });

  it("rejects non-existent user", async () => {
    const result = await Login_Operation({
      identifier: "ghost@nowhere.com",
      password: "somepassword",
    });
    expect(result.success).toBe(false);
    expect(result._OPS_MESSAGE).toBe("Invalid credentials.");
  });

  it("returns same error for wrong password and missing user", async () => {
    const wrong_user = await Login_Operation({
      identifier: "ghost@nowhere.com",
      password: "somepassword",
    });
    const wrong_pass = await Login_Operation({
      identifier: TEST_USER.email,
      password: "wrongpassword",
    });
    // Both should return identical message (credential enumeration prevention)
    expect(wrong_user._OPS_MESSAGE).toBe(wrong_pass._OPS_MESSAGE);
  });

  it("rejects empty identifier and password", async () => {
    const result = await Login_Operation({
      identifier: "",
      password: "",
    });
    expect(result.success).toBe(false);
    expect(result._OPS_MESSAGE).toBe("Identifier and password are required.");
  });

  it("rejects empty password only", async () => {
    const result = await Login_Operation({
      identifier: TEST_USER.email,
      password: "",
    });
    expect(result.success).toBe(false);
  });

});