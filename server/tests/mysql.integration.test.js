import test from "node:test";
import assert from "node:assert/strict";
import mysql from "mysql2/promise";
import request from "supertest";
import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { LicenseRepository } from "../src/repositories/license.repository.js";
import { AdminRepository } from "../src/repositories/admin.repository.js";
import { displayPartsForKey, hashLicenseKey } from "../src/utils/token.js";
import { hashPassword } from "../src/utils/admin-auth.js";
import { secondsFromNow } from "../src/utils/time.js";

const shouldRun = process.env.MYSQL_INTEGRATION_TEST === "1";
const mysqlTest = shouldRun ? test : test.skip;

const VALID_KEY = "AR-MSQL-TEST-KEY1-0001";
const INSTALLATION_ID = "44444444-4444-4444-8444-444444444444";
const INSTALLATION_ID_2 = "55555555-5555-5555-8555-555555555555";

async function resetTables(connection) {
  if (!env.db.database.endsWith("_test")) {
    throw new Error("Refusing to run MySQL integration test against non-test database");
  }
  await connection.execute("SET FOREIGN_KEY_CHECKS=0");
  await connection.execute("TRUNCATE TABLE admin_audit_events");
  await connection.execute("TRUNCATE TABLE admin_users");
  await connection.execute("TRUNCATE TABLE license_events");
  await connection.execute("TRUNCATE TABLE license_tokens");
  await connection.execute("TRUNCATE TABLE license_devices");
  await connection.execute("TRUNCATE TABLE licenses");
  await connection.execute("SET FOREIGN_KEY_CHECKS=1");
}

mysqlTest("real MySQL activation, validation, and deactivation", async () => {
  const connection = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    timezone: "Z"
  });
  await resetTables(connection);
  await connection.end();

  const pool = mysql.createPool({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    waitForConnections: true,
    connectionLimit: 4,
    timezone: "Z"
  });

  try {
    const repository = new LicenseRepository(pool);
    const display = displayPartsForKey(VALID_KEY);
    await repository.createLicense({
      keyHash: hashLicenseKey(VALID_KEY, env.license.keyPepper),
      keyPrefix: display.prefix,
      keyLast4: display.last4,
      plan: "pro",
      maxDevices: 1,
      expiresAt: secondsFromNow(86400)
    });

    const app = createApp({ repository, config: env });
    const activation = await request(app)
      .post("/api/v1/licenses/activate")
      .send({
        licenseKey: VALID_KEY,
        installationId: INSTALLATION_ID,
        clientVersion: "4.0.0-dev",
        device: { platform: "android", executor: "direct" }
      })
      .expect(200);
    assert.equal(activation.body.valid, true);
    assert.equal(activation.body.plan, "pro");
    assert.equal(typeof activation.body.token, "string");

    const validation = await request(app)
      .post("/api/v1/licenses/validate")
      .send({
        installationId: INSTALLATION_ID,
        clientVersion: "4.0.0-dev",
        token: activation.body.token
      })
      .expect(200);
    assert.equal(validation.body.valid, true);
    assert.equal(validation.body.token, undefined);

    await pool.execute("UPDATE licenses SET plan = 'standard', updated_at = UTC_TIMESTAMP() WHERE id = 1");
    const downgraded = await request(app)
      .post("/api/v1/licenses/validate")
      .send({
        installationId: INSTALLATION_ID,
        clientVersion: "4.0.0-dev",
        token: activation.body.token
      })
      .expect(200);
    assert.equal(downgraded.body.valid, true);
    assert.equal(downgraded.body.plan, "standard");
    assert.equal(downgraded.body.maxInstances, 5);
    assert.equal(downgraded.body.features.includes("installer"), false);

    await pool.execute("UPDATE licenses SET status = 'revoked', updated_at = UTC_TIMESTAMP() WHERE id = 1");
    const revoked = await request(app)
      .post("/api/v1/licenses/validate")
      .send({
        installationId: INSTALLATION_ID,
        clientVersion: "4.0.0-dev",
        token: activation.body.token
      })
      .expect(403);
    assert.equal(revoked.body.valid, false);
    assert.equal(revoked.body.code, "REVOKED");

    await pool.execute("UPDATE licenses SET status = 'active', plan = 'pro', updated_at = UTC_TIMESTAMP() WHERE id = 1");

    const deactivation = await request(app)
      .post("/api/v1/licenses/deactivate")
      .send({
        installationId: INSTALLATION_ID,
        token: activation.body.token
      })
      .expect(200);
    assert.equal(deactivation.body.deactivated, true);

    const afterDeactivate = await request(app)
      .post("/api/v1/licenses/validate")
      .send({
        installationId: INSTALLATION_ID,
        clientVersion: "4.0.0-dev",
        token: activation.body.token
      })
      .expect(403);
    assert.equal(afterDeactivate.body.valid, false);
    assert.equal(afterDeactivate.body.code, "REVOKED");

    const [tokens] = await pool.execute("SELECT token_hash FROM license_tokens");
    assert.notEqual(tokens[0].token_hash, activation.body.token);
  } finally {
    await pool.end();
  }
});

mysqlTest("real MySQL full Admin + License + Device lifecycle", async () => {
  const connection = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    timezone: "Z"
  });
  await resetTables(connection);
  await connection.end();

  const pool = mysql.createPool({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    waitForConnections: true,
    connectionLimit: 4,
    timezone: "Z"
  });

  try {
    const licenseRepo = new LicenseRepository(pool);
    const adminRepo = new AdminRepository(pool);

    // Bootstrap an admin
    const passwordHash = await hashPassword("AdminSuperPassword1234");
    const adminId = await adminRepo.createAdminUser({
      username: "sysadmin",
      passwordHash,
      role: "super_admin",
      status: "active"
    });

    const app = createApp({ repository: licenseRepo, adminRepository: adminRepo, config: env });

    // 1. Admin logs in
    const loginRes = await request(app)
      .post("/api/v1/admin/auth/login")
      .send({ username: "sysadmin", password: "AdminSuperPassword1234" })
      .expect(200);
    assert.equal(loginRes.body.ok, true);
    const adminToken = loginRes.body.token;
    assert.ok(adminToken);

    const authHeaders = { Authorization: `Bearer ${adminToken}` };

    // 2. Admin creates license (maxDevices: 1)
    const createRes = await request(app)
      .post("/api/v1/admin/licenses")
      .set(authHeaders)
      .send({ plan: "pro", maxDevices: 1, expiresInDays: 30 })
      .expect(201);
    assert.equal(createRes.body.ok, true);
    const rawLicenseKey = createRes.body.licenseKey;
    const licenseId = createRes.body.license.id;
    assert.ok(rawLicenseKey);

    // Verify raw key is NOT stored in DB
    const [licRows] = await pool.execute("SELECT * FROM licenses WHERE id = ?", [licenseId]);
    assert.notEqual(licRows[0].license_key_hash, rawLicenseKey);

    // 3. Customer activates with raw key (Device 1)
    const activate1 = await request(app)
      .post("/api/v1/licenses/activate")
      .send({
        licenseKey: rawLicenseKey,
        installationId: INSTALLATION_ID,
        clientVersion: "4.0.0-dev",
        device: { platform: "android", executor: "direct" }
      })
      .expect(200);
    assert.equal(activate1.body.valid, true);
    const device1Token = activate1.body.token;

    // 4. Admin checks devices list
    const devicesRes = await request(app)
      .get(`/api/v1/admin/licenses/${licenseId}/devices`)
      .set(authHeaders)
      .expect(200);
    assert.equal(devicesRes.body.items.length, 1);
    assert.equal(devicesRes.body.items[0].maskedInstallationId, "4444****4444");
    const device1Id = devicesRes.body.items[0].id;

    // 5. Device 2 attempts activation -> fails DEVICE_LIMIT (maxDevices is 1)
    const activate2 = await request(app)
      .post("/api/v1/licenses/activate")
      .send({
        licenseKey: rawLicenseKey,
        installationId: INSTALLATION_ID_2,
        clientVersion: "4.0.0-dev",
        device: { platform: "android", executor: "direct" }
      })
      .expect(403);
    assert.equal(activate2.body.valid, false);
    assert.equal(activate2.body.code, "DEVICE_LIMIT");

    // 6. Admin suspends license
    await request(app)
      .post(`/api/v1/admin/licenses/${licenseId}/suspend`)
      .set(authHeaders)
      .expect(200);

    // Customer validate returns SUSPENDED
    const suspendedVal = await request(app)
      .post("/api/v1/licenses/validate")
      .send({ installationId: INSTALLATION_ID, clientVersion: "4.0.0-dev", token: device1Token })
      .expect(403);
    assert.equal(suspendedVal.body.code, "SUSPENDED");

    // 7. Admin reactivates license
    await request(app)
      .post(`/api/v1/admin/licenses/${licenseId}/reactivate`)
      .set(authHeaders)
      .expect(200);

    // Customer validate succeeds
    const activeVal = await request(app)
      .post("/api/v1/licenses/validate")
      .send({ installationId: INSTALLATION_ID, clientVersion: "4.0.0-dev", token: device1Token })
      .expect(200);
    assert.equal(activeVal.body.valid, true);

    // 8. Admin resets / revokes Device 1
    const revokeDevRes = await request(app)
      .post(`/api/v1/admin/licenses/${licenseId}/devices/${device1Id}/revoke`)
      .set(authHeaders)
      .expect(200);
    assert.equal(revokeDevRes.body.ok, true);

    // Device 1 validation now fails REVOKED
    const dev1AfterRevoke = await request(app)
      .post("/api/v1/licenses/validate")
      .send({ installationId: INSTALLATION_ID, clientVersion: "4.0.0-dev", token: device1Token })
      .expect(403);
    assert.equal(dev1AfterRevoke.body.code, "REVOKED");

    // Device 2 can now activate because slot was freed!
    const activate2Success = await request(app)
      .post("/api/v1/licenses/activate")
      .send({
        licenseKey: rawLicenseKey,
        installationId: INSTALLATION_ID_2,
        clientVersion: "4.0.0-dev",
        device: { platform: "android", executor: "direct" }
      })
      .expect(200);
    assert.equal(activate2Success.body.valid, true);

    // 9. Admin revokes entire license
    await request(app)
      .post(`/api/v1/admin/licenses/${licenseId}/revoke`)
      .set(authHeaders)
      .expect(200);

    // Device 2 validation fails REVOKED
    const dev2ValAfterLicRevoke = await request(app)
      .post("/api/v1/licenses/validate")
      .send({
        installationId: INSTALLATION_ID_2,
        clientVersion: "4.0.0-dev",
        token: activate2Success.body.token
      })
      .expect(403);
    assert.equal(dev2ValAfterLicRevoke.body.code, "REVOKED");

    // 10. Audit events were recorded in admin_audit_events table
    const [auditRows] = await pool.execute("SELECT * FROM admin_audit_events ORDER BY id ASC");
    assert.ok(auditRows.length >= 5);
    assert.ok(auditRows.some((a) => a.action === "admin_login_success"));
    assert.ok(auditRows.some((a) => a.action === "license_created"));
    assert.ok(auditRows.some((a) => a.action === "license_suspended"));
    assert.ok(auditRows.some((a) => a.action === "license_reactivated"));
    assert.ok(auditRows.some((a) => a.action === "device_revoked"));
    assert.ok(auditRows.some((a) => a.action === "license_revoked"));
  } finally {
    await pool.end();
  }
});
