#!/usr/bin/env node
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { getPool, closePool } from "../src/db/pool.js";
import { AdminRepository } from "../src/repositories/admin.repository.js";
import { hashPassword } from "../src/utils/admin-auth.js";
import { ADMIN_ROLES, ADMIN_STATUSES } from "../src/constants/admin.js";

function parseArgs(argv) {
  const args = {
    username: "",
    role: ADMIN_ROLES.ADMIN,
    password: process.env.ADMIN_PASSWORD || ""
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--username") {
      args.username = argv[++i];
    } else if (arg === "--role") {
      args.role = argv[++i];
    } else if (arg === "--password") {
      args.password = argv[++i];
      console.warn("\n[SECURITY WARNING] Passing password via CLI arguments exposes it in shell history. Prefer ADMIN_PASSWORD env or interactive prompt.\n");
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node scripts/create-admin.js --username <username> [--role admin|super_admin] [--password <password>]");
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!args.username || args.username.trim().length === 0) {
    throw new Error("--username is required");
  }

  if (!Object.values(ADMIN_ROLES).includes(args.role)) {
    throw new Error(`Invalid role: ${args.role}. Allowed: ${Object.values(ADMIN_ROLES).join(", ")}`);
  }

  return args;
}

async function promptPassword() {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question("Enter admin password (min 6 characters): ");
    return answer.trim();
  } finally {
    rl.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let password = args.password;

  if (!password) {
    password = await promptPassword();
  }

  if (!password || password.length < 6) {
    throw new Error("Admin password must be at least 6 characters long");
  }

  const passwordHash = await hashPassword(password);
  const repository = new AdminRepository(getPool());

  const existing = await repository.findAdminByUsername(args.username.trim());
  let adminId;

  if (existing) {
    await repository.updateAdminPassword(existing.id, passwordHash);
    adminId = existing.id;
    console.log(`[OK] Updated password for existing admin: ${args.username}`);
  } else {
    adminId = await repository.createAdminUser({
      username: args.username.trim(),
      passwordHash,
      role: args.role,
      status: ADMIN_STATUSES.ACTIVE
    });
    console.log(`[OK] Created new admin user: ${args.username} (ID: ${adminId}, Role: ${args.role})`);
  }

  await repository.insertAudit({
    adminUserId: adminId,
    action: "admin_user_upserted",
    targetType: "admin_user",
    targetId: String(adminId),
    metadata: { username: args.username, role: args.role }
  });
}

main()
  .catch((error) => {
    console.error(`create-admin failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(closePool);
