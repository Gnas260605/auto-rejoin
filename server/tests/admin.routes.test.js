import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.js";
import { signAdminToken } from "../src/utils/admin-auth.js";

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
  constructor() {
    this.admins = [{ id: 1, username: "admin", role: "admin", status: "active" }];
    this.licenses = [
      {
        id: 1,
        license_key_prefix: "AR-ABCD",
        license_key_last4: "WXYZ",
        plan: "pro",
        status: "active",
        max_devices: 2,
        expires_at: null,
        created_at: new Date(),
        updated_at: new Date(),
        active_devices_count: 0
      }
    ];
    this.devices = [];
    this.audits = [];
    this.events = [];
  }

  async findAdminById(id) {
    return this.admins.find((a) => a.id === Number(id)) || null;
  }

  async findAdminByUsername(u) {
    return this.admins.find((a) => a.username === u) || null;
  }

  async insertAudit(a) {
    this.audits.push(a);
  }

  async listAudits() {
    return { items: this.audits, total: this.audits.length, page: 1, limit: 20, totalPages: 1 };
  }

  async listLicenses() {
    return { items: this.licenses, total: this.licenses.length, page: 1, limit: 20, totalPages: 1 };
  }

  async findLicenseById(id) {
    return this.licenses.find((l) => l.id === Number(id)) || null;
  }

  async updateLicense(id, fields) {
    const lic = this.licenses.find((l) => l.id === Number(id));
    if (lic) Object.assign(lic, fields);
  }

  async updateLicenseStatus(id, status) {
    const lic = this.licenses.find((l) => l.id === Number(id));
    if (lic) lic.status = status;
  }

  async extendLicense() {}

  async revokeAllTokensForLicense() {}

  async listDevicesForLicense() {
    return { items: this.devices, total: this.devices.length, page: 1, limit: 50, totalPages: 1 };
  }

  async findDeviceById() {
    return null;
  }

  async revokeDeviceAndTokens() {}

  async listEventsForLicense() {
    return { items: this.events, total: this.events.length, page: 1, limit: 20, totalPages: 1 };
  }

  async getDashboardStats() {
    return { total: 1, active: 1, suspended: 0, revoked: 0, expired: 0, expiringSoon: 0, activeDevices: 0 };
  }
}

class MockLicenseRepository {
  async createLicense(fields) {
    return 2;
  }
  async insertEvent() {}
}

function getAuthHeader() {
  const token = signAdminToken({ id: 1, username: "admin", role: "admin" }, TEST_SECRET, 3600);
  return { Authorization: `Bearer ${token}` };
}

test("Admin Routes: GET /api/v1/admin/meta/plans returns plans list", async () => {
  const adminRepo = new MockAdminRepository();
  const licenseRepo = new MockLicenseRepository();
  const app = createApp({ repository: licenseRepo, adminRepository: adminRepo, config: baseConfig });

  const res = await request(app)
    .get("/api/v1/admin/meta/plans")
    .set(getAuthHeader())
    .expect(200);

  assert.equal(res.body.ok, true);
  assert.ok(Array.isArray(res.body.plans));
  assert.ok(res.body.plans.some((p) => p.plan === "pro"));
});

test("Admin Routes: GET /api/v1/admin/stats returns counts", async () => {
  const adminRepo = new MockAdminRepository();
  const licenseRepo = new MockLicenseRepository();
  const app = createApp({ repository: licenseRepo, adminRepository: adminRepo, config: baseConfig });

  const res = await request(app)
    .get("/api/v1/admin/stats")
    .set(getAuthHeader())
    .expect(200);

  assert.equal(res.body.ok, true);
  assert.equal(res.body.stats.total, 1);
  assert.equal(res.body.stats.active, 1);
});

test("Admin Routes: POST /api/v1/admin/licenses creates license and returns raw key", async () => {
  const adminRepo = new MockAdminRepository();
  const licenseRepo = new MockLicenseRepository();
  const app = createApp({ repository: licenseRepo, adminRepository: adminRepo, config: baseConfig });

  const res = await request(app)
    .post("/api/v1/admin/licenses")
    .set(getAuthHeader())
    .send({ plan: "standard", maxDevices: 3, expiresInDays: 30 })
    .expect(201);

  assert.equal(res.body.ok, true);
  assert.ok(res.body.licenseKey);
  assert.equal(res.body.license.plan, "standard");
  assert.equal(res.body.license.maxDevices, 3);
});

test("Admin Routes: Validation failures return 400 with structured errors", async () => {
  const adminRepo = new MockAdminRepository();
  const licenseRepo = new MockLicenseRepository();
  const app = createApp({ repository: licenseRepo, adminRepository: adminRepo, config: baseConfig });

  const res = await request(app)
    .post("/api/v1/admin/licenses")
    .set(getAuthHeader())
    .send({ maxDevices: -5 })
    .expect(400);

  assert.equal(res.body.ok, false);
  assert.equal(res.body.code, "INVALID_REQUEST");
});
