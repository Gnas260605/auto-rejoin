import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function main() {
  const { getPool } = await import("../src/db/pool.js");
  const { LicenseRepository } = await import("../src/repositories/license.repository.js");
  const { AdminRepository } = await import("../src/repositories/admin.repository.js");
  const { AdminService } = await import("../src/services/admin.service.js");
  const { env } = await import("../src/config/env.js");

  const pool = getPool();
  try {
    const adminRepo = new AdminRepository(pool);
    const licenseRepo = new LicenseRepository(pool);
    const adminService = new AdminService({
      adminRepository: adminRepo,
      licenseRepository: licenseRepo,
      config: env
    });

    const newKey = await adminService.createLicense({
      plan: "business",
      maxDevices: 100,
      expiresInDays: 3650,
      customerName: "Admin VIP",
      customerContact: "Admin",
      salesChannel: "admin_manual",
      customerNote: "VIP Business 100 Clones Auto Rejoin Key"
    }, { adminId: 1, ip: "127.0.0.1" });

    console.log("SUCCESS");
    console.log(JSON.stringify(newKey, null, 2));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

main();
