import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.js";
import { hashPassword, signAdminToken, verifyAdminToken } from "../src/utils/admin-auth.js";
import { ADMIN_COOKIE_NAME } from "../src/constants/admin.js";

const TEST_SECRET = "test_admin_jwt_secret_must_be_32_bytes_long!!";

const baseConfig = {
  nodeEnv: "test",
  license: {
    keyPepper: "test_pepper_12345678901234567890",
    tokenTtlSeconds: 86400,
    revalidateAfterSeconds: 3600,
    minClientVersion: "",
    maintenance: { enabled: false }
  },
  admin: {
    jwtSecret: TEST_SECRET,
    tokenTtlSeconds: 3600,
    origins: ["*"],
    cookieSecure: false,
    cookieSameSite: "lax"
  },
  rateLimit: {
    enabled: false
  }
};

class MockAdminRepository {
  constructor(admins = []) {
    this.admins = [...admins];
    this.audits = [];
  }

  async findAdminByUsername(username) {
    return this.admins.find((a) => a.username === username) || null;
  }

  async findAdminById(id) {
    return this.admins.find((a) => a.id === Number(id)) || null;
  }

  async updateAdminLastLogin(_id) {}

  async insertAudit(audit) {
    this.audits.push(audit);
  }
}

class MockLicenseRepository {
  async listLicenses() {
    return { items: [], total: 0, page: 1, limit: 20, totalPages: 1 };
  }
}

test("admin password hash and verify utils", async () => {
  await assert.rejects(
    async () => hashPassword("short"),
    /Password must be at least 12 characters/
  );

  const hash = await hashPassword("my_super_secret_password_123");
  assert.equal(typeof hash, "string");
  assert.notEqual(hash, "my_super_secret_password_123");

  const valid = await hashPassword("my_super_secret_password_123");
  assert.ok(valid);
});

test("admin JWT signing and verification", () => {
  const token = signAdminToken({ id: 1, username: "admin", role: "super_admin" }, TEST_SECRET, 60);
  assert.equal(typeof token, "string");

  const verified = verifyAdminToken(token, TEST_SECRET);
  assert.equal(verified.sub, "1");
  assert.equal(verified.username, "admin");
  assert.equal(verified.role, "super_admin");

  const invalid = verifyAdminToken("corrupted.token.value", TEST_SECRET);
  assert.equal(invalid, null);
});

test("admin login with valid credentials succeeds and returns cookie and token", async () => {
  const passwordHash = await hashPassword("ValidPassword1234");
  const adminRepo = new MockAdminRepository([
    { id: 1, username: "admin", password_hash: passwordHash, role: "admin", status: "active" }
  ]);
  const licenseRepo = new MockLicenseRepository();

  const app = createApp({ repository: licenseRepo, adminRepository: adminRepo, config: baseConfig });

  const res = await request(app)
    .post("/api/v1/admin/auth/login")
    .send({ username: "admin", password: "ValidPassword1234" })
    .expect(200);

  assert.equal(res.body.ok, true);
  assert.equal(res.body.admin.username, "admin");
  assert.equal(typeof res.body.token, "string");

  const cookieHeader = res.headers["set-cookie"];
  assert.ok(cookieHeader);
  assert.ok(cookieHeader.some((c) => c.includes(ADMIN_COOKIE_NAME)));
});

test("admin login fails for wrong password or missing user", async () => {
  const passwordHash = await hashPassword("ValidPassword1234");
  const adminRepo = new MockAdminRepository([
    { id: 1, username: "admin", password_hash: passwordHash, role: "admin", status: "active" }
  ]);
  const licenseRepo = new MockLicenseRepository();

  const app = createApp({ repository: licenseRepo, adminRepository: adminRepo, config: baseConfig });

  const wrongPass = await request(app)
    .post("/api/v1/admin/auth/login")
    .send({ username: "admin", password: "WrongPassword999" })
    .expect(401);
  assert.equal(wrongPass.body.ok, false);
  assert.equal(wrongPass.body.code, "INVALID_CREDENTIALS");

  const noUser = await request(app)
    .post("/api/v1/admin/auth/login")
    .send({ username: "unknown_user", password: "SomePassword1234" })
    .expect(401);
  assert.equal(noUser.body.ok, false);
  assert.equal(noUser.body.code, "INVALID_CREDENTIALS");
});

test("disabled admin account is rejected", async () => {
  const passwordHash = await hashPassword("ValidPassword1234");
  const adminRepo = new MockAdminRepository([
    { id: 2, username: "disabled_admin", password_hash: passwordHash, role: "admin", status: "disabled" }
  ]);
  const licenseRepo = new MockLicenseRepository();

  const app = createApp({ repository: licenseRepo, adminRepository: adminRepo, config: baseConfig });

  const res = await request(app)
    .post("/api/v1/admin/auth/login")
    .send({ username: "disabled_admin", password: "ValidPassword1234" })
    .expect(403);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.code, "ADMIN_DISABLED");
});

test("unauthenticated access to admin routes is blocked (401)", async () => {
  const adminRepo = new MockAdminRepository([]);
  const licenseRepo = new MockLicenseRepository();

  const app = createApp({ repository: licenseRepo, adminRepository: adminRepo, config: baseConfig });

  const res = await request(app)
    .get("/api/v1/admin/licenses")
    .expect(401);

  assert.equal(res.body.ok, false);
  assert.equal(res.body.code, "UNAUTHORIZED");
});

test("authenticated access via Bearer header and Cookie is accepted", async () => {
  const passwordHash = await hashPassword("ValidPassword1234");
  const adminRepo = new MockAdminRepository([
    { id: 1, username: "admin", password_hash: passwordHash, role: "admin", status: "active" }
  ]);
  const licenseRepo = new MockLicenseRepository();

  const app = createApp({ repository: licenseRepo, adminRepository: adminRepo, config: baseConfig });

  const token = signAdminToken({ id: 1, username: "admin", role: "admin" }, TEST_SECRET, 3600);

  // via Bearer header
  const resHeader = await request(app)
    .get("/api/v1/admin/auth/me")
    .set("Authorization", `Bearer ${token}`)
    .expect(200);
  assert.equal(resHeader.body.ok, true);
  assert.equal(resHeader.body.admin.username, "admin");

  // via Cookie
  const resCookie = await request(app)
    .get("/api/v1/admin/auth/me")
    .set("Cookie", [`${ADMIN_COOKIE_NAME}=${token}`])
    .expect(200);
  assert.equal(resCookie.body.ok, true);
  assert.equal(resCookie.body.admin.username, "admin");
});
