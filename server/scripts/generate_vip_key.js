import { env } from "../src/config/env.js";
import { getPool } from "../src/db/pool.js";
import { LicenseRepository } from "../src/repositories/license.repository.js";
import { AdminRepository } from "../src/repositories/admin.repository.js";
import { AdminService } from "../src/services/admin.service.js";

async function main() {
  const pool = getPool();
  const licenseRepo = new LicenseRepository(pool);
  const adminRepo = new AdminRepository(pool);
  const adminService = new AdminService({
    adminRepository: adminRepo,
    licenseRepository: licenseRepo,
    config: env
  });

  try {
    const keyData = await adminService.createDirectSaleLicense({
      plan: "lifetime",
      maxDevices: 5,
      customerName: "Owner VIP",
      customerContact: "Owner",
      salesChannel: "DIRECT_ADMIN",
      customerNote: "VIP Lifetime key for system testing & owner use"
    });

    console.log("=== VIP LICENSE GENERATED ===");
    console.log("RAW_KEY:", keyData.rawKey);
    console.log("PLAN:", keyData.plan);
    console.log("MAX_DEVICES:", keyData.maxDevices);
    console.log("EXPIRES_AT:", keyData.expiresAt || "Vĩnh viễn (Lifetime)");
    console.log("=============================");
  } catch (err) {
    console.error("Error creating VIP license:", err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
