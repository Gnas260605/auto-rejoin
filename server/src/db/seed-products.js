import { getPool, closePool } from "./pool.js";
import { toSqlDate } from "../utils/time.js";

export async function seedDefaultProducts() {
  const pool = getPool();
  const now = toSqlDate();

  await pool.query("DELETE FROM fulfillments");
  await pool.query("DELETE FROM commerce_order_items");
  await pool.query("DELETE FROM commerce_orders");
  await pool.query("DELETE FROM digital_inventory_items");
  await pool.query("DELETE FROM product_variants");
  await pool.query("DELETE FROM products");

  console.log("Updating catalog: Auto Rejoin Key & Reset HWID only...");

  // 1. Auto Rejoin Pro Key
  const [p1] = await pool.query(
    `INSERT INTO products (slug, name, type, category, short_description, description, thumbnail_url, badge, is_public, sort_order, created_at, updated_at)
     VALUES ('auto-rejoin-pro', 'Auto Rejoin Pro — Key Bản Quyền', 'LICENSE', 'tools', 
             'Công cụ chống văng, tự vào lại server vắng người và chống AFK 24/7 đỉnh cao trên Android / Termux & PC.',
             'Auto Rejoin Pro là giải pháp hàng đầu giúp bạn tự động vào lại phòng khi bị mất kết nối, tự động tìm kiếm server 0-2 người để tránh bị PK, hỗ trợ chạy nền 24/7 không cần giữ màn hình sáng.',
             'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
             'Bán Chạy', 1, 1, ?, ?)`,
    [now, now]
  );
  const p1Id = p1.insertId;

  await pool.query(
    `INSERT INTO product_variants (product_id, sku, name, price, original_price, currency, duration_days, max_devices, stock_quantity, is_active, created_at, updated_at)
     VALUES 
     (?, 'AR-1D', 'Gói Dùng Thử (1 Ngày - 1 Máy)', 10000, 15000, 'VND', 1, 1, -1, 1, ?, ?),
     (?, 'AR-7D', 'Gói Tiết Kiệm (7 Ngày - 1 Máy)', 40000, 60000, 'VND', 7, 1, -1, 1, ?, ?),
     (?, 'AR-30D', 'Gói Tiêu Chuẩn (30 Ngày - 2 Máy)', 100000, 150000, 'VND', 30, 2, -1, 1, ?, ?),
     (?, 'AR-LIFETIME', 'Gói Vĩnh Viễn (Trọn Đời - 4 Máy)', 250000, 390000, 'VND', NULL, 4, -1, 1, ?, ?)`,
    [p1Id, now, now, p1Id, now, now, p1Id, now, now, p1Id, now, now]
  );

  // 2. Dịch vụ Reset HWID / Đổi Thiết Bị
  const [p2] = await pool.query(
    `INSERT INTO products (slug, name, type, category, short_description, description, thumbnail_url, badge, is_public, sort_order, created_at, updated_at)
     VALUES ('reset-hwid', 'Reset HWID — Đổi Máy Thiết Bị', 'SERVICE', 'services',
             'Tự động xóa liên kết thiết bị cũ đang khóa vào Key để kích hoạt sang điện thoại hoặc giả lập khác tức thì 24/7.',
             'Dành cho khách hàng đổi điện thoại, cài lại máy hoặc chuyển tab giả lập mà không cần chờ Admin can thiệp thủ công.',
             'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80',
             'Tự Động 24/7', 1, 2, ?, ?)`,
    [now, now]
  );
  const p2Id = p2.insertId;

  await pool.query(
    `INSERT INTO product_variants (product_id, sku, name, price, original_price, currency, duration_days, max_devices, stock_quantity, is_active, created_at, updated_at)
     VALUES 
     (?, 'RS-HWID-1X', 'Gói Reset HWID (1 Lần Đổi Máy)', 10000, 20000, 'VND', NULL, NULL, -1, 1, ?, ?)`,
    [p2Id, now, now]
  );

  console.log("Database updated successfully: Only Auto Rejoin Key & Reset HWID are present.");
}

if (process.argv[1] && process.argv[1].endsWith("seed-products.js")) {
  seedDefaultProducts()
    .catch((err) => console.error("Seed error:", err))
    .finally(closePool);
}
