#!/usr/bin/env node
/**
 * Mã hoá các license key đã cấp còn lưu dạng thô trong payments.issued_raw_key.
 * Chạy 1 lần sau khi deploy + `npm run migrate` (cần migration 012). Chạy lại nhiều lần vẫn an toàn.
 *
 *   node scripts/encrypt-issued-keys.js            # mã hoá
 *   node scripts/encrypt-issued-keys.js --dry-run  # chỉ đếm
 */
import { env } from "../src/config/env.js";
import { closePool, getPool } from "../src/db/pool.js";
import { isSealedValue, openSealedValue, sealValue } from "../src/utils/crypto.js";

const dryRun = process.argv.includes("--dry-run");
const secret = env.license.keyEncryptionKey || env.license.keyPepper;

if (!secret) {
  console.error("LICENSE_KEY_PEPPER (hoặc LICENSE_KEY_ENCRYPTION_KEY) chưa được cấu hình.");
  process.exit(1);
}

const pool = getPool();
try {
  const [rows] = await pool.query(
    "SELECT id, issued_raw_key FROM payments WHERE issued_raw_key IS NOT NULL AND issued_raw_key NOT LIKE 'enc:v1:%'"
  );
  console.log(`Tìm thấy ${rows.length} license key đang lưu thô.`);

  let sealed = 0;
  for (const row of rows) {
    if (isSealedValue(row.issued_raw_key)) continue;
    const value = sealValue(row.issued_raw_key, secret);
    // Kiểm tra giải mã lại được trước khi ghi đè.
    if (openSealedValue(value, secret) !== row.issued_raw_key) {
      throw new Error(`Round-trip failed for payment id=${row.id}`);
    }
    if (!dryRun) {
      await pool.execute(
        "UPDATE payments SET issued_raw_key = ? WHERE id = ? AND issued_raw_key = ?",
        [value, row.id, row.issued_raw_key]
      );
    }
    sealed++;
  }
  console.log(dryRun ? `[dry-run] Sẽ mã hoá ${sealed} key.` : `Đã mã hoá ${sealed} key.`);
} finally {
  await closePool().catch(() => {});
}
