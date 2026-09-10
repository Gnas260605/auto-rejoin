import test from "node:test";
import assert from "node:assert/strict";
import { AdminService, AdminServiceError } from "../src/services/admin.service.js";
import { PLAN_ENTITLEMENTS, LICENSE_STATUSES } from "../src/constants/license.js";

const config = {
  license: {
    keyPepper: "test_key_pepper_12345678901234567890",
    tokenTtlSeconds: 86400,
    revalidateAfterSeconds: 3600
  },
  admin: {
    jwtSecret: "test_secret_for_jwt_32_characters_long",
    tokenTtlSeconds: 86400
  }
};

class MemoryAdminRepository {
  constructor() {
    this.admins = [];
    this.licenses = [];
    this.devices = [];
    this.tokens = [];
    this.licenseEvents = [];
    this.audits = [];
    this.nextId = 1;
  }

  async findAdminByUsername(username) {
    return this.admins.find((a) => a.username === username) || null;
  }

  async findAdminById(id) {
    return this.admins.find((a) => a.id === Number(id)) || null;
  }

  async updateAdminLastLogin(id) {
    const admin = this.admins.find((a) => a.id === Number(id));
    if (admin) admin.last_login_at = new Date();
  }

  async insertAudit(fields) {
    this.audits.push({ id: this.nextId++, ...fields, created_at: new Date() });
  }

  async listAudits({ page = 1, limit = 20 }) {
    const start = (page - 1) * limit;
    return {
      items: this.audits.slice(start, start + limit),
      total: this.audits.length,
      page,
      limit,
      totalPages: Math.ceil(this.audits.length / limit) || 1
    };
  }

  async listLicenses({ page = 1, limit = 20, search, status, plan }) {
    let filtered = [...this.licenses];
    if (search) {
      filtered = filtered.filter((l) => l.license_key_prefix.includes(search) || l.license_key_last4.includes(search));
    }
    if (status) {
      filtered = filtered.filter((l) => l.status === status);
    }
    if (plan) {
      filtered = filtered.filter((l) => l.plan === plan);
    }
    const start = (page - 1) * limit;
    return {
      items: filtered.slice(start, start + limit).map((l) => ({
        ...l,
        active_devices_count: this.devices.filter((d) => d.license_id === l.id && !d.revoked_at).length
      })),
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit) || 1
    };
  }

  async findLicenseById(id) {
    const lic = this.licenses.find((l) => l.id === Number(id));
    if (!lic) return null;
    return {
      ...lic,
      active_devices_count: this.devices.filter((d) => d.license_id === lic.id && !d.revoked_at).length
    };
  }

  async updateLicense(id, fields) {
    const lic = this.licenses.find((l) => l.id === Number(id));
    if (lic) {
      if (fields.plan !== undefined) lic.plan = fields.plan;
      if (fields.maxDevices !== undefined) lic.max_devices = fields.maxDevices;
      if (fields.expiresAt !== undefined) lic.expires_at = fields.expiresAt;
      lic.updated_at = new Date();
    }
  }

  async updateLicenseStatus(id, status) {
    const lic = this.licenses.find((l) => l.id === Number(id));
    if (lic) {
      lic.status = status;
      lic.updated_at = new Date();
    }
  }

  async extendLicense(id, days) {
    const lic = this.licenses.find((l) => l.id === Number(id));
    if (lic) {
      const base = lic.expires_at && lic.expires_at > new Date() ? new Date(lic.expires_at) : new Date();
      lic.expires_at = new Date(base.getTime() + days * 86400 * 1000);
      lic.updated_at = new Date();
    }
  }

  async revokeAllTokensForLicense(licenseId) {
    this.tokens.filter((t) => t.license_id === Number(licenseId)).forEach((t) => {
      t.revoked_at = new Date();
    });
  }

  async listDevicesForLicense(licenseId, { page = 1, limit = 50 }) {
    const filtered = this.devices.filter((d) => d.license_id === Number(licenseId));
    const start = (page - 1) * limit;
    return {
      items: filtered.slice(start, start + limit),
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit) || 1
    };
  }

  async findDeviceById(licenseId, deviceId) {
    return this.devices.find((d) => d.license_id === Number(licenseId) && d.id === Number(deviceId)) || null;
  }

  async revokeDeviceAndTokens(deviceId) {
    const dev = this.devices.find((d) => d.id === Number(deviceId));
    if (dev) {
      dev.revoked_at = new Date();
      dev.updated_at = new Date();
    }
    this.tokens.filter((t) => t.device_id === Number(deviceId)).forEach((t) => {
      t.revoked_at = new Date();
    });
  }

  async listEventsForLicense(licenseId, { page = 1, limit = 20 }) {
    const filtered = this.licenseEvents.filter((e) => e.license_id === Number(licenseId));
    const start = (page - 1) * limit;
    return {
      items: filtered.slice(start, start + limit),
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit) || 1
    };
  }

  async getDashboardStats() {
    return {
      total: this.licenses.length,
      active: this.licenses.filter((l) => l.status === "active").length,
      suspended: this.licenses.filter((l) => l.status === "suspended").length,
      revoked: this.licenses.filter((l) => l.status === "revoked").length,
      expired: this.licenses.filter((l) => l.status === "expired").length,
      expiringSoon: 0,
      activeDevices: this.devices.filter((d) => !d.revoked_at).length
    };
  }
}

class MemoryLicenseRepository {
  constructor(adminRepo) {
    this.adminRepo = adminRepo;
  }

  async createLicense(fields) {
    const id = this.adminRepo.nextId++;
    const now = new Date();
    this.adminRepo.licenses.push({
      id,
      license_key_hash: fields.keyHash,
      license_key_prefix: fields.keyPrefix,
      license_key_last4: fields.keyLast4,
      plan: fields.plan,
      status: "active",
      max_devices: fields.maxDevices,
      expires_at: fields.expiresAt,
      created_at: now,
      updated_at: now
    });
    return id;
  }

  async insertEvent(fields) {
    this.adminRepo.licenseEvents.push({
      id: this.adminRepo.nextId++,
      license_id: fields.licenseId,
      device_id: fields.deviceId,
      event_type: fields.eventType,
      ip_address: fields.ipAddress,
      metadata_json: fields.metadata,
      created_at: new Date()
    });
  }
}

test("AdminService: createLicense returns raw key once and persists hash", async () => {
  const adminRepo = new MemoryAdminRepository();
  const licenseRepo = new MemoryLicenseRepository(adminRepo);
  const service = new AdminService({ adminRepository: adminRepo, licenseRepository: licenseRepo, config });

  const result = await service.createLicense(
    { plan: "pro", maxDevices: 3, expiresInDays: 30 },
    { adminId: 1, ip: "127.0.0.1" }
  );

  assert.ok(result.licenseKey);
  assert.match(result.licenseKey, /^AR-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.equal(result.license.plan, "pro");
  assert.equal(result.license.maxDevices, 3);
  assert.equal(result.license.maxInstances, 20);

  // Stored in repo has hash, not raw key
  const stored = adminRepo.licenses[0];
  assert.notEqual(stored.license_key_hash, result.licenseKey);
  assert.equal(stored.license_key_prefix, result.licenseKey.slice(0, 8));

  // Audit event was recorded
  assert.equal(adminRepo.audits.length, 1);
  assert.equal(adminRepo.audits[0].action, "license_created");
});

test("AdminService: license lifecycle: update, extend, suspend, reactivate, revoke", async () => {
  const adminRepo = new MemoryAdminRepository();
  const licenseRepo = new MemoryLicenseRepository(adminRepo);
  const service = new AdminService({ adminRepository: adminRepo, licenseRepository: licenseRepo, config });

  const created = await service.createLicense({ plan: "standard", maxDevices: 2, expiresInDays: 10 }, { adminId: 1 });
  const licId = created.license.id;

  // Update
  const updated = await service.updateLicense(licId, { plan: "business", maxDevices: 5 }, { adminId: 1 });
  assert.equal(updated.plan, "business");
  assert.equal(updated.maxDevices, 5);
  assert.equal(updated.maxInstances, 100);

  // Extend
  const extended = await service.extendLicense(licId, 15, { adminId: 1 });
  assert.ok(new Date(extended.expiresAt) > new Date(updated.expiresAt));

  // Suspend
  const suspended = await service.suspendLicense(licId, { adminId: 1 });
  assert.equal(suspended.status, "suspended");

  // Reactivate
  const reactivated = await service.reactivateLicense(licId, { adminId: 1 });
  assert.equal(reactivated.status, "active");

  // Revoke
  const revoked = await service.revokeLicense(licId, { adminId: 1 });
  assert.equal(revoked.status, "revoked");

  // Cannot reactivate revoked
  await assert.rejects(
    async () => service.reactivateLicense(licId, { adminId: 1 }),
    (err) => err instanceof AdminServiceError && err.code === "REVOKED_LICENSE"
  );
});

test("AdminService: device management and revocation", async () => {
  const adminRepo = new MemoryAdminRepository();
  const licenseRepo = new MemoryLicenseRepository(adminRepo);
  const service = new AdminService({ adminRepository: adminRepo, licenseRepository: licenseRepo, config });

  const created = await service.createLicense({ plan: "pro" }, { adminId: 1 });
  const licId = created.license.id;

  // Add dummy device and token
  adminRepo.devices.push({
    id: 10,
    license_id: licId,
    installation_id: "12345678-abcd-1234-abcd-123456789abc",
    device_name: "Test Phone",
    platform: "android",
    executor: "direct",
    client_version: "4.0.0",
    first_activated_at: new Date(),
    last_seen_at: new Date(),
    revoked_at: null
  });
  adminRepo.tokens.push({
    id: 100,
    license_id: licId,
    device_id: 10,
    token_hash: "dummy_hash",
    revoked_at: null
  });

  const devices = await service.listDevices(licId);
  assert.equal(devices.items.length, 1);
  assert.equal(devices.items[0].maskedInstallationId, "1234****9abc");
  assert.equal(devices.items[0].status, "active");

  // Revoke device
  const revokeRes = await service.revokeDevice(licId, 10, { adminId: 1 });
  assert.equal(revokeRes.ok, true);
  assert.equal(revokeRes.status, "revoked");

  // Token was revoked
  assert.ok(adminRepo.tokens[0].revoked_at);
  assert.ok(adminRepo.devices[0].revoked_at);
});
