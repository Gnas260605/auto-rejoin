import assert from "node:assert/strict";
import test from "node:test";
import { loadEnv } from "../src/config/env.js";

const ORIGINAL_ENV = { ...process.env };

function withEnv(overrides, fn) {
  process.env = { ...ORIGINAL_ENV, ...overrides };
  try {
    return fn();
  } finally {
    process.env = { ...ORIGINAL_ENV };
  }
}

const productionBase = {
  NODE_ENV: "production",
  DB_NAME: "auto_rejoin_license",
  ADMIN_ORIGIN: "https://admin.example.com",
  COOKIE_SECURE: "true",
  RATE_LIMIT_ENABLED: "true",
  LICENSE_KEY_PEPPER: "prod_license_pepper_32_chars_minimum_value",
  ADMIN_JWT_SECRET: "prod_admin_jwt_secret_32_chars_minimum_value"
};

test("production env accepts strong explicit settings", () => {
  const env = withEnv(productionBase, () => loadEnv());

  assert.equal(env.nodeEnv, "production");
  assert.equal(env.db.database, "auto_rejoin_license");
  assert.equal(env.admin.cookieSecure, true);
  assert.deepEqual(env.admin.origins, ["https://admin.example.com"]);
});

test("production env rejects test database", () => {
  assert.throws(
    () => withEnv({ ...productionBase, DB_NAME: "auto_rejoin_license_test" }, () => loadEnv()),
    /DB_NAME must not point to a _test database/
  );
});

test("production env rejects weak admin secret", () => {
  assert.throws(
    () => withEnv({ ...productionBase, ADMIN_JWT_SECRET: "short" }, () => loadEnv()),
    /ADMIN_JWT_SECRET must be at least 32/
  );
});

test("production env rejects wildcard admin origin", () => {
  assert.throws(
    () => withEnv({ ...productionBase, ADMIN_ORIGIN: "*" }, () => loadEnv()),
    /ADMIN_ORIGIN must be explicit/
  );
});

test("COOKIE_SAME_SITE alias is accepted", () => {
  const env = withEnv({ ...productionBase, COOKIE_SAMESITE: "", COOKIE_SAME_SITE: "strict" }, () => loadEnv());

  assert.equal(env.admin.cookieSameSite, "strict");
});
