#!/usr/bin/env node
/**
 * Auto Rejoin Pro - production readiness preflight.
 *
 * This script is intentionally conservative. It must fail when pointed at
 * development/test configuration, weak secrets, missing tables, or insecure
 * admin/browser settings.
 */

import { env } from "../src/config/env.js";
import { closePool, getPool } from "../src/db/pool.js";

const results = [];

function check(label, passed, details = "") {
  results.push({ label, passed, details });
}

function isPlaceholder(value) {
  return /change-this|replace|placeholder|dev_insecure/i.test(value || "");
}

function hasStrongSecret(value) {
  return typeof value === "string" && value.length >= 32 && !isPlaceholder(value);
}

console.log("\n========================================================");
console.log("  Auto Rejoin Pro - Production Readiness Preflight");
console.log("========================================================\n");

check(
  "NODE_ENV is production",
  env.nodeEnv === "production",
  `current=${env.nodeEnv}`
);

check(
  "DB_NAME is not a _test database",
  !env.db.database.endsWith("_test"),
  `database=${env.db.database}`
);

check(
  "LICENSE_KEY_PEPPER is strong",
  hasStrongSecret(env.license.keyPepper),
  `length=${env.license.keyPepper.length}${isPlaceholder(env.license.keyPepper) ? " placeholder=true" : ""}`
);

check(
  "ADMIN_JWT_SECRET is strong",
  hasStrongSecret(env.admin.jwtSecret),
  `length=${env.admin.jwtSecret.length}${isPlaceholder(env.admin.jwtSecret) ? " placeholder=true" : ""}`
);

check(
  "COOKIE_SECURE is enabled",
  env.admin.cookieSecure === true,
  `current=${env.admin.cookieSecure}`
);

check(
  "ADMIN_ORIGIN is explicit",
  env.admin.origins.length > 0 && !env.admin.origins.includes("*"),
  `origins=${env.admin.origins.join(",") || "(none)"}`
);

check(
  "RATE_LIMIT_ENABLED is enabled",
  env.rateLimit.enabled === true,
  `current=${env.rateLimit.enabled}`
);

try {
  const pool = getPool();
  const [rows] = await pool.query("SELECT 1 AS is_alive, DATABASE() AS db_name");
  const isAlive = rows?.[0]?.is_alive === 1;
  check("MySQL connection is alive", isAlive, `database=${rows?.[0]?.db_name || "(unknown)"}`);

  const [tables] = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
  `);
  const tableNames = tables.map((row) => Object.values(row)[0]);
  const requiredTables = [
    "schema_migrations",
    "licenses",
    "license_devices",
    "license_tokens",
    "license_events",
    "admin_users",
    "admin_audit_events",
    "system_settings",
    "payments"
  ];
  const missingTables = requiredTables.filter((table) => !tableNames.includes(table));
  check(
    "Required database tables exist",
    missingTables.length === 0,
    missingTables.length === 0 ? `found=${requiredTables.length}` : `missing=${missingTables.join(",")}`
  );
} catch (error) {
  check("MySQL connection is alive", false, `error=${error.message}`);
} finally {
  await closePool().catch(() => {});
}

let allPassed = true;
for (const [index, item] of results.entries()) {
  const status = item.passed ? "PASS" : "FAIL";
  const color = item.passed ? "\x1b[32m" : "\x1b[31m";
  console.log(`${index + 1}. [${color}${status}\x1b[0m] ${item.label}`);
  if (item.details) {
    console.log(`   - ${item.details}`);
  }
  if (!item.passed) {
    allPassed = false;
  }
}

console.log("\n--------------------------------------------------------");
if (allPassed) {
  console.log("\x1b[32mProduction preflight passed.\x1b[0m");
} else {
  console.log("\x1b[33mProduction preflight failed. Fix every FAIL before go-live.\x1b[0m");
}
console.log("========================================================\n");

process.exit(allPassed ? 0 : 1);
