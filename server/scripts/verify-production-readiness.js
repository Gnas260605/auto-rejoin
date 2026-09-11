#!/usr/bin/env node
/**
 * Auto Rejoin Pro — Pre-flight Production Readiness Verification Script
 * Checks configuration, environment variables, security keys, and readiness.
 *
 * Usage:
 *   node scripts/verify-production-readiness.js
 */

import { config } from "../src/config/env.js";
import { getPool } from "../src/db/connection.js";

const results = [];

function check(label, passed, details = "") {
  results.push({ label, passed, details });
}

console.log("\n========================================================");
console.log("  Auto Rejoin Pro — Production Readiness Pre-flight Check");
console.log("========================================================\n");

// 1. Check Node Environment
check(
  "NODE_ENV is 'production'",
  config.nodeEnv === "production",
  `Current value: "${config.nodeEnv}"`
);

// 2. Check License Key Pepper Strength
const pepperLength = config.licenseKeyPepper ? config.licenseKeyPepper.length : 0;
const isPepperDefault = config.licenseKeyPepper?.includes("change-this") || config.licenseKeyPepper?.includes("REPLACE");
check(
  "LICENSE_KEY_PEPPER is set and strong (>= 32 chars)",
  pepperLength >= 32 && !isPepperDefault,
  `Length: ${pepperLength} chars${isPepperDefault ? " (WARNING: placeholder detected!)" : ""}`
);

// 3. Check Admin JWT Secret Strength
const jwtLength = config.adminJwtSecret ? config.adminJwtSecret.length : 0;
const isJwtDefault = config.adminJwtSecret?.includes("change-this") || config.adminJwtSecret?.includes("REPLACE");
check(
  "ADMIN_JWT_SECRET is set and strong (>= 32 chars)",
  jwtLength >= 32 && !isJwtDefault,
  `Length: ${jwtLength} chars${isJwtDefault ? " (WARNING: placeholder detected!)" : ""}`
);

// 4. Check Cookie Security
check(
  "COOKIE_SECURE is enabled",
  config.cookieSecure === true,
  `Current value: ${config.cookieSecure} (Must be true when serving over HTTPS)`
);

// 5. Check Admin Origin / CORS
const originIsWildcard = config.adminOrigin === "*";
check(
  "ADMIN_ORIGIN is not wildcard '*'",
  !originIsWildcard && Boolean(config.adminOrigin),
  `Current value: "${config.adminOrigin}"`
);

// 6. Test Database Connection
try {
  const pool = getPool();
  const [rows] = await pool.query("SELECT 1 as is_alive, DATABASE() as db_name, VERSION() as db_version");
  check(
    "MySQL Database connection alive",
    rows && rows.length > 0 && rows[0].is_alive === 1,
    `Connected to: ${rows[0].db_name || "default"} (${rows[0].db_version})`
  );

  // Check essential tables
  const [tables] = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = DATABASE()
  `);
  const tableNames = tables.map((t) => Object.values(t)[0]);
  const requiredTables = ["licenses", "license_devices", "admin_users", "audit_logs"];
  const missingTables = requiredTables.filter((t) => !tableNames.includes(t));

  check(
    "Essential database tables exist",
    missingTables.length === 0,
    missingTables.length === 0
      ? `Found ${tableNames.length} tables (${tableNames.slice(0, 5).join(", ")}...)`
      : `Missing tables: ${missingTables.join(", ")}`
  );
} catch (err) {
  check("MySQL Database connection alive", false, `Error: ${err.message}`);
}

// Print Report
let allPassed = true;
results.forEach((item, index) => {
  const statusIcon = item.passed ? "✓ PASS" : "✗ FAIL";
  const color = item.passed ? "\x1b[32m" : "\x1b[31m";
  console.log(`${index + 1}. [${color}${statusIcon}\x1b[0m] ${item.label}`);
  if (item.details) {
    console.log(`   ↳ ${item.details}`);
  }
  if (!item.passed) allPassed = false;
});

console.log("\n--------------------------------------------------------");
if (allPassed) {
  console.log("\x1b[32m✔ TẤT CẢ KIỂM TRA ĐẠT CHUẨN PRODUCTION!\x1b[0m Hệ thống sẵn sàng triển khai.");
} else {
  console.log("\x1b[33m⚠ MỘT SỐ HẠNG MỤC CHƯA ĐẠT CHUẨN.\x1b[0m Vui lòng kiểm tra các mục FAIL trước khi Go-Live.");
}
console.log("========================================================\n");

process.exit(allPassed ? 0 : 1);
