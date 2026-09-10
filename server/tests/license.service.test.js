import test from "node:test";
import assert from "node:assert/strict";
import { LicenseService } from "../src/services/license.service.js";
import { hashLicenseKey, hashToken } from "../src/utils/token.js";

const config = {
  license: {
    keyPepper: "test-pepper-with-enough-entropy",
    tokenTtlSeconds: 3600,
    revalidateAfterSeconds: 900
  },
  rateLimit: {
    enabled: false,
    windowMs: 60000,
    activateMax: 100,
    validateMax: 100,
    deactivateMax: 100
  }
};

const VALID_KEY = "AR-ABCD-EFGH-IJKL-1234";
const INSTALLATION_A = "11111111-1111-4111-8111-111111111111";
const INSTALLATION_B = "22222222-2222-4222-8222-222222222222";
const INSTALLATION_C = "33333333-3333-4333-8333-333333333333";

class MemoryRepository {
  constructor(state = {}) {
    this.state = {
      licenses: [],
      devices: [],
      tokens: [],
      events: [],
      nextDeviceId: 1,
      nextTokenId: 1,
      lock: Promise.resolve(),
      ...state
    };
  }

  async withTransaction(work) {
    const previous = this.state.lock;
    let release;
    this.state.lock = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await work(this);
    } finally {
      release();
    }
  }

  async findLicenseByKeyHashForUpdate(keyHash) {
    return this.state.licenses.find((license) => license.license_key_hash === keyHash) || null;
  }

  async findDeviceByInstallationId(licenseId, installationId) {
    return this.state.devices.find((device) => device.license_id === licenseId && device.installation_id === installationId) || null;
  }

  async countActiveDevicesForLicense(licenseId) {
    return this.state.devices.filter((device) => device.license_id === licenseId && !device.revoked_at).length;
  }

  async createDevice(fields) {
    const device = {
      id: this.state.nextDeviceId++,
      license_id: fields.licenseId,
      installation_id: fields.installationId,
      platform: fields.platform,
      executor: fields.executor,
      revoked_at: null
    };
    this.state.devices.push(device);
    return device;
  }

  async updateDeviceSeen(deviceId) {
    const device = this.state.devices.find((item) => item.id === deviceId);
    if (device) {
      device.revoked_at = null;
    }
  }

  async createToken(fields) {
    this.state.tokens.push({
      id: this.state.nextTokenId++,
      license_id: fields.licenseId,
      device_id: fields.deviceId,
      token_hash: fields.tokenHash,
      expires_at: fields.expiresAt,
      revoked_at: null
    });
  }

  async findTokenBundleByHash(tokenHash) {
    const token = this.state.tokens.find((item) => item.token_hash === tokenHash);
    if (!token) {
      return null;
    }
    const device = this.state.devices.find((item) => item.id === token.device_id);
    const license = this.state.licenses.find((item) => item.id === token.license_id);
    return {
      token_id: token.id,
      token_expires_at: token.expires_at,
      token_revoked_at: token.revoked_at,
      device_id: device.id,
      installation_id: device.installation_id,
      device_revoked_at: device.revoked_at,
      license_id: license.id,
      plan: license.plan,
      status: license.status,
      license_expires_at: license.expires_at
    };
  }

  async touchTokenAndDevice(tokenId, deviceId) {
    this.lastTouched = { tokenId, deviceId };
  }

  async revokeDeviceAndTokens(deviceId) {
    const device = this.state.devices.find((item) => item.id === deviceId);
    if (device) {
      device.revoked_at = new Date();
    }
    for (const token of this.state.tokens.filter((item) => item.device_id === deviceId)) {
      token.revoked_at = new Date();
    }
  }

  async insertEvent(fields) {
    this.state.events.push(fields);
  }
}

function createRepo(licenseOverrides = {}) {
  const normalizedKey = VALID_KEY.toUpperCase();
  const repo = new MemoryRepository();
  repo.state.licenses.push({
    id: 1,
    license_key_hash: hashLicenseKey(normalizedKey, config.license.keyPepper),
    plan: "pro",
    status: "active",
    max_devices: 2,
    expires_at: new Date(Date.now() + 86400000),
    ...licenseOverrides
  });
  return repo;
}

function createService(repo, token = "test-token-opaque-secret") {
  return new LicenseService({
    repository: repo,
    config,
    tokenUtils: {
      generateOpaqueToken: () => token
    }
  });
}

test("activate valid license returns token and entitlements", async () => {
  const repo = createRepo();
  const service = createService(repo);
  const response = await service.activate({
    licenseKey: VALID_KEY,
    installationId: INSTALLATION_A,
    clientVersion: "4.0.0-dev",
    device: { platform: "android", executor: "root" }
  });

  assert.equal(response.valid, true);
  assert.equal(response.plan, "pro");
  assert.equal(response.maxInstances, 20);
  assert.deepEqual(response.features, ["monitor", "doctor", "discord", "profiles", "installer"]);
  assert.equal(response.token, "test-token-opaque-secret");
  assert.equal(repo.state.tokens[0].token_hash, hashToken("test-token-opaque-secret"));
  assert.notEqual(repo.state.tokens[0].token_hash, "test-token-opaque-secret");
});

test("invalid, expired, revoked, and suspended licenses fail", async () => {
  const invalid = await createService(createRepo()).activate({
    licenseKey: "AR-FAIL-FAIL-FAIL-FAIL",
    installationId: INSTALLATION_A,
    clientVersion: "4.0.0-dev"
  });
  assert.equal(invalid.code, "INVALID_KEY");

  for (const [status, code] of [["expired", "EXPIRED"], ["revoked", "REVOKED"], ["suspended", "SUSPENDED"]]) {
    const response = await createService(createRepo({ status })).activate({
      licenseKey: VALID_KEY,
      installationId: INSTALLATION_A,
      clientVersion: "4.0.0-dev"
    });
    assert.equal(response.valid, false);
    assert.equal(response.code, code);
  }
});

test("device limit applies only to new installations", async () => {
  const repo = createRepo({ max_devices: 1 });
  const service = createService(repo, "token-a");
  const first = await service.activate({ licenseKey: VALID_KEY, installationId: INSTALLATION_A, clientVersion: "4.0.0-dev" });
  assert.equal(first.valid, true);

  const reactivation = await createService(repo, "token-a2").activate({ licenseKey: VALID_KEY, installationId: INSTALLATION_A, clientVersion: "4.0.0-dev" });
  assert.equal(reactivation.valid, true);

  const second = await createService(repo, "token-b").activate({ licenseKey: VALID_KEY, installationId: INSTALLATION_B, clientVersion: "4.0.0-dev" });
  assert.equal(second.valid, false);
  assert.equal(second.code, "DEVICE_LIMIT");
});

test("concurrent activations cannot exceed repository transaction limit", async () => {
  const repo = createRepo({ max_devices: 1 });
  const service = createService(repo);
  const [a, b] = await Promise.all([
    service.activate({ licenseKey: VALID_KEY, installationId: INSTALLATION_B, clientVersion: "4.0.0-dev" }),
    service.activate({ licenseKey: VALID_KEY, installationId: INSTALLATION_C, clientVersion: "4.0.0-dev" })
  ]);
  const successes = [a, b].filter((item) => item.valid).length;
  const limits = [a, b].filter((item) => item.code === "DEVICE_LIMIT").length;
  assert.equal(successes, 1);
  assert.equal(limits, 1);
  assert.equal(repo.state.devices.filter((device) => !device.revoked_at).length, 1);
});

test("validate token enforces token, expiry, installation, license status", async () => {
  const repo = createRepo();
  const service = createService(repo, "validate-token");
  await service.activate({ licenseKey: VALID_KEY, installationId: INSTALLATION_A, clientVersion: "4.0.0-dev" });

  const valid = await service.validate({ installationId: INSTALLATION_A, token: "validate-token", clientVersion: "4.0.0-dev" });
  assert.equal(valid.valid, true);
  assert.equal(valid.licenseId, "lic_1");

  const mismatch = await service.validate({ installationId: INSTALLATION_B, token: "validate-token", clientVersion: "4.0.0-dev" });
  assert.equal(mismatch.code, "INSTALLATION_MISMATCH");

  repo.state.tokens[0].expires_at = new Date(Date.now() - 1000);
  const expiredToken = await service.validate({ installationId: INSTALLATION_A, token: "validate-token", clientVersion: "4.0.0-dev" });
  assert.equal(expiredToken.code, "TOKEN_EXPIRED");
});

test("deactivate revokes device and future validation fails", async () => {
  const repo = createRepo();
  const service = createService(repo, "deactivate-token");
  await service.activate({ licenseKey: VALID_KEY, installationId: INSTALLATION_A, clientVersion: "4.0.0-dev" });

  const deactivated = await service.deactivate({ installationId: INSTALLATION_A, token: "deactivate-token" });
  assert.equal(deactivated.deactivated, true);

  const validate = await service.validate({ installationId: INSTALLATION_A, token: "deactivate-token", clientVersion: "4.0.0-dev" });
  assert.equal(validate.code, "REVOKED");
});

test("sql injection-like inputs are rejected before repository lookup", async () => {
  const repo = createRepo();
  const service = createService(repo);
  const response = await service.activate({
    licenseKey: "' OR 1=1 --",
    installationId: INSTALLATION_A,
    clientVersion: "4.0.0-dev"
  });
  assert.equal(response.valid, false);
  assert.equal(response.code, "INVALID_REQUEST");
});
