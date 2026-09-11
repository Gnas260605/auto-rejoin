import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.js";
import { hashLicenseKey } from "../src/utils/token.js";

const config = {
  license: {
    keyPepper: "test-pepper-with-enough-entropy",
    tokenTtlSeconds: 3600,
    revalidateAfterSeconds: 3600,
    maintenance: {
      enabled: false,
      allowCachedEntitlements: true,
      message: "License service maintenance"
    }
  },
  rateLimit: {
    enabled: false,
    windowMs: 60000,
    activateMax: 100,
    validateMax: 100,
    deactivateMax: 100
  }
};

class RouteRepo {
  constructor() {
    this.license = {
      id: 7,
      license_key_hash: hashLicenseKey("AR-ABCD-EFGH-IJKL-1234", config.license.keyPepper),
      plan: "standard",
      status: "active",
      max_devices: 1,
      expires_at: new Date(Date.now() + 86400000)
    };
    this.device = null;
    this.tokens = [];
    this.events = [];
  }

  async withTransaction(work) {
    return work(this);
  }

  async findLicenseByKeyHashForUpdate(hash) {
    return hash === this.license.license_key_hash ? this.license : null;
  }

  async findDeviceByInstallationId(_licenseId, installationId) {
    return this.device?.installation_id === installationId ? this.device : null;
  }

  async countActiveDevicesForLicense() {
    return this.device && !this.device.revoked_at ? 1 : 0;
  }

  async createDevice(fields) {
    this.device = { id: 9, license_id: fields.licenseId, installation_id: fields.installationId, revoked_at: null };
    return this.device;
  }

  async updateDeviceSeen() {}

  async createToken(fields) {
    this.tokens.push({ id: 11, ...fields, revoked_at: null });
  }

  async findTokenBundleByHash(tokenHash) {
    const token = this.tokens.find((item) => item.tokenHash === tokenHash || item.token_hash === tokenHash);
    if (!token || !this.device) {
      return null;
    }
    return {
      token_id: 11,
      token_expires_at: token.expiresAt || token.expires_at,
      token_revoked_at: token.revoked_at,
      device_id: this.device.id,
      installation_id: this.device.installation_id,
      device_revoked_at: this.device.revoked_at,
      license_id: this.license.id,
      plan: this.license.plan,
      status: this.license.status,
      license_expires_at: this.license.expires_at
    };
  }

  async touchTokenAndDevice() {}

  async revokeDeviceAndTokens() {
    this.device.revoked_at = new Date();
    this.tokens[0].revoked_at = new Date();
  }

  async insertEvent(fields) {
    this.events.push(fields);
  }
}

const installationId = "11111111-1111-4111-8111-111111111111";

test("health returns ok without leaking database details in injected mode", async () => {
  const app = createApp({ repository: new RouteRepo(), config });
  const response = await request(app).get("/api/v1/health").expect(200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.database, "ok");
  assert.equal(typeof response.body.time, "string");
  assert.equal(response.body.DB_PASSWORD, undefined);
});

test("activation, validation, and deactivation match shell client contract", async () => {
  const repo = new RouteRepo();
  const app = createApp({ repository: repo, config });

  const activation = await request(app)
    .post("/api/v1/licenses/activate")
    .send({
      licenseKey: "AR-ABCD-EFGH-IJKL-1234",
      installationId,
      clientVersion: "4.0.0-dev",
      device: { platform: "android", executor: "root" }
    })
    .expect(200);

  assert.equal(activation.body.valid, true);
  assert.equal(activation.body.licenseId, "lic_7");
  assert.equal(activation.body.plan, "standard");
  assert.equal(activation.body.maxInstances, 5);
  assert.deepEqual(activation.body.features, ["monitor", "doctor", "low_server", "anti_afk", "discord", "profiles"]);
  assert.equal(typeof activation.body.token, "string");

  const validation = await request(app)
    .post("/api/v1/licenses/validate")
    .send({ installationId, clientVersion: "4.0.0-dev", token: activation.body.token })
    .expect(200);
  assert.equal(validation.body.valid, true);
  assert.equal(validation.body.token, undefined);

  const deactivation = await request(app)
    .post("/api/v1/licenses/deactivate")
    .send({ installationId, token: activation.body.token })
    .expect(200);
  assert.equal(deactivation.body.deactivated, true);
});

test("invalid activation request is bounded and canonical", async () => {
  const app = createApp({ repository: new RouteRepo(), config });
  const response = await request(app)
    .post("/api/v1/licenses/activate")
    .send({
      licenseKey: "'; DROP TABLE licenses; --",
      installationId,
      clientVersion: "4.0.0-dev"
    })
    .expect(400);

  assert.equal(response.body.valid, false);
  assert.equal(response.body.code, "INVALID_REQUEST");
  assert.equal(response.body.error.code, "INVALID_REQUEST");
});

test("malformed JSON returns invalid request instead of server error", async () => {
  const app = createApp({ repository: new RouteRepo(), config });
  const response = await request(app)
    .post("/api/v1/licenses/activate")
    .set("Content-Type", "application/json")
    .send("{not-json")
    .expect(400);

  assert.equal(response.body.valid, false);
  assert.equal(response.body.code, "INVALID_REQUEST");
});

test("maintenance mode is returned without breaking success contract", async () => {
  const repo = new RouteRepo();
  const app = createApp({
    repository: repo,
    config: {
      ...config,
      license: {
        ...config.license,
        maintenance: {
          enabled: true,
          allowCachedEntitlements: true,
          message: "planned maintenance"
        }
      }
    }
  });

  const response = await request(app)
    .post("/api/v1/licenses/activate")
    .send({
      licenseKey: "AR-ABCD-EFGH-IJKL-1234",
      installationId,
      clientVersion: "4.0.0-dev",
      device: { platform: "android", executor: "root" }
    })
    .expect(200);

  assert.equal(response.body.valid, true);
  assert.deepEqual(response.body.maintenance, {
    enabled: true,
    allowCachedEntitlements: true,
    message: "planned maintenance"
  });
});
