import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.js";
import { hashLicenseKey, normalizeLicenseKey } from "../src/utils/token.js";

const PEPPER = "test_pepper_12345678901234567890";
const API_KEY = "internal_api_key_for_tests_0123456789";
const RAW_KEY = "AR-AAAA-BBBB-CCCC-DDDD";
const KEY_HASH = hashLicenseKey(normalizeLicenseKey(RAW_KEY), PEPPER);

function makeRepo() {
  const repo = {
    calls: [],
    sql: [],
    devices: [
      { id: 11, installation_id: "11111111-2222-4333-8444-555555555555", device_name: "UGPhone 1", platform: "android", executor: "root", client_version: "4.5.0", first_activated_at: new Date(), last_seen_at: new Date() },
      { id: 12, installation_id: "66666666-7777-4888-9999-000000000000", device_name: null, platform: "android", executor: "adb", client_version: "4.5.0", first_activated_at: new Date(), last_seen_at: new Date() }
    ],
    async findLicenseByKeyHash(hash) {
      return hash === KEY_HASH ? { id: 5, status: "active", plan: "plan_30days", max_devices: 2, expires_at: null } : null;
    },
    async listActiveDevicesForLicense() { return repo.devices; },
    async revokeDeviceAndTokens(id) { repo.calls.push(["one", id]); },
    async revokeAllDevicesForLicense(id) { repo.calls.push(["all", id]); },
    async insertEvent(e) { repo.calls.push(["event", e.eventType]); },
    pool: {
      async query(sql, params) {
        repo.sql.push(sql);
        if (/SELECT id FROM licenses/.test(sql)) return [[{ id: 5 }]];
        return [{ affectedRows: 1 }];
      }
    }
  };
  return repo;
}

function makeApp(repo) {
  return createApp({
    repository: repo,
    adminRepository: {},
    paymentRepository: {},
    commerceRepository: {},
    userRepository: {},
    walletRepository: {},
    rbacRepository: {},
    config: {
      nodeEnv: "test",
      internalApiKey: API_KEY,
      license: { keyPepper: PEPPER, maintenance: { enabled: false } },
      admin: { jwtSecret: "admin_secret_for_tests_32_characters!", origins: ["*"] },
      customer: { jwtSecret: "customer_secret_for_tests_32_chars!!" },
      payment: { webhookSecret: "" },
      rateLimit: { enabled: false }
    }
  });
}

const post = (app, path, body) => request(app).post(`/api/v1/internal${path}`).set("x-internal-api-key", API_KEY).send(body);

test("Internal devices: requires internal API key", async () => {
  await request(makeApp(makeRepo())).post("/api/v1/internal/licenses/devices").send({ rawKey: RAW_KEY }).expect(401);
});

test("Internal devices: lists active devices with masked installation ids", async () => {
  const res = await post(makeApp(makeRepo()), "/licenses/devices", { rawKey: RAW_KEY }).expect(200);
  assert.equal(res.body.license.maxDevices, 2);
  assert.equal(res.body.license.activeDevices, 2);
  assert.equal(res.body.devices[0].installationId, "1111****5555");
  assert.ok(!JSON.stringify(res.body).includes("11111111-2222"), "installation id đầy đủ không được lộ");
});

test("Internal devices: unknown key -> 404", async () => {
  await post(makeApp(makeRepo()), "/licenses/devices", { rawKey: "AR-ZZZZ-ZZZZ-ZZZZ-ZZZZ" }).expect(404);
});

test("Internal devices reset: single device of this license", async () => {
  const repo = makeRepo();
  const res = await post(makeApp(repo), "/licenses/devices/reset", { rawKey: RAW_KEY, deviceId: 12 }).expect(200);
  assert.equal(res.body.revoked, 1);
  assert.deepEqual(repo.calls.slice(0, 2), [["one", 12], ["event", "device_reset_by_shop"]]);
});

test("Internal devices reset: device of another license is rejected", async () => {
  const repo = makeRepo();
  await post(makeApp(repo), "/licenses/devices/reset", { rawKey: RAW_KEY, deviceId: 999 }).expect(404);
  assert.equal(repo.calls.length, 0);
});

test("Internal devices reset: all devices", async () => {
  const repo = makeRepo();
  const res = await post(makeApp(repo), "/licenses/devices/reset", { rawKey: RAW_KEY }).expect(200);
  assert.equal(res.body.revoked, 2);
  assert.deepEqual(repo.calls[0], ["all", 5]);
});

test("Internal revoke: revokes devices via revoked_at (no license_devices.status column)", async () => {
  const repo = makeRepo();
  await post(makeApp(repo), "/licenses/revoke", { rawKey: RAW_KEY }).expect(200);
  assert.ok(!repo.sql.some((s) => /license_devices SET status/i.test(s)), "không được dùng cột status không tồn tại");
  assert.deepEqual(repo.calls[0], ["all", 5]);
});

test("Internal revoke/extend: rawKey wins over a keyHash computed with the Shop's pepper", async () => {
  const shopHash = hashLicenseKey(normalizeLicenseKey(RAW_KEY), "shopblox_license_pepper_key_2026");
  const repo = makeRepo();
  repo.pool.query = async (sql, params) => {
    repo.sql.push(sql);
    if (/SELECT id(, expires_at)? FROM licenses/.test(sql)) return [params[0] === KEY_HASH ? [{ id: 5, expires_at: null }] : []];
    return [{ affectedRows: 1 }];
  };
  const app = makeApp(repo);
  await post(app, "/licenses/revoke", { rawKey: RAW_KEY, keyHash: shopHash }).expect(200);
  await post(app, "/licenses/extend", { rawKey: RAW_KEY, keyHash: shopHash, daysToAdd: 30 }).expect(200);
  // Chỉ có hash của Shop (không rawKey) thì không tra được: đúng như hành vi cũ gây lỗi.
  await post(app, "/licenses/extend", { keyHash: shopHash, daysToAdd: 30 }).expect(404);
});
