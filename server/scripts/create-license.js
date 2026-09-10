#!/usr/bin/env node
import { env } from "../src/config/env.js";
import { getPool, closePool } from "../src/db/pool.js";
import { LicenseRepository } from "../src/repositories/license.repository.js";
import { displayPartsForKey, generateLicenseKey, hashLicenseKey } from "../src/utils/token.js";
import { secondsFromNow } from "../src/utils/time.js";
import { PLAN_ENTITLEMENTS } from "../src/constants/license.js";

function parseArgs(argv) {
  const args = {
    plan: "pro",
    devices: 1,
    days: 30
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--plan") {
      args.plan = argv[++i];
    } else if (arg === "--devices") {
      args.devices = Number.parseInt(argv[++i], 10);
    } else if (arg === "--days") {
      args.days = Number.parseInt(argv[++i], 10);
    } else if (arg === "--lifetime") {
      args.days = null;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (!PLAN_ENTITLEMENTS[args.plan]) {
    throw new Error(`Unknown plan: ${args.plan}`);
  }
  if (!Number.isInteger(args.devices) || args.devices < 1 || args.devices > 10000) {
    throw new Error("--devices must be between 1 and 10000");
  }
  if (args.days !== null && (!Number.isInteger(args.days) || args.days < 1 || args.days > 3650)) {
    throw new Error("--days must be between 1 and 3650, or use --lifetime");
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!env.license.keyPepper || env.license.keyPepper.length < 16) {
    throw new Error("LICENSE_KEY_PEPPER must be configured before creating licenses");
  }

  const rawKey = generateLicenseKey();
  const normalizedKey = rawKey.toUpperCase();
  const display = displayPartsForKey(normalizedKey);
  const repository = new LicenseRepository(getPool());
  const licenseId = await repository.createLicense({
    keyHash: hashLicenseKey(normalizedKey, env.license.keyPepper),
    keyPrefix: display.prefix,
    keyLast4: display.last4,
    plan: args.plan,
    maxDevices: args.devices,
    expiresAt: args.days === null ? null : secondsFromNow(args.days * 86400)
  });
  await repository.insertEvent({
    licenseId,
    eventType: "license_created",
    metadata: {
      plan: args.plan,
      maxDevices: args.devices,
      expiresAt: args.days === null ? null : `${args.days}d`
    }
  });

  console.log("License created:");
  console.log(rawKey);
  console.log(`ID: ${licenseId}`);
  console.log(`Plan: ${args.plan}`);
  console.log(`Devices: ${args.devices}`);
  console.log("Store the raw key now. It is not stored in the database.");
}

main()
  .catch((error) => {
    console.error(`create-license failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(closePool);
