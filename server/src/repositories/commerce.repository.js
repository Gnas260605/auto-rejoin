import { toSqlDate, isoNow } from "../utils/time.js";

export class CommerceRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async listPublicProducts() {
    const [products] = await this.pool.query(
      `SELECT id, slug, name, type, category, short_description AS shortDescription, 
              description, thumbnail_url AS thumbnailUrl, badge, sort_order AS sortOrder, created_at AS createdAt
       FROM products 
       WHERE is_public = 1 AND status = 'ACTIVE'
       ORDER BY sort_order ASC, id ASC`
    );

    if (!products.length) return [];

    const productIds = products.map((p) => p.id);
    const [variants] = await this.pool.query(
      `SELECT id, product_id AS productId, sku, name, price, original_price AS originalPrice,
              currency, duration_days AS durationDays, max_devices AS maxDevices,
              metadata_json AS metadata, stock_quantity AS stockQuantity, is_active AS isActive
       FROM product_variants
       WHERE product_id IN (?) AND is_active = 1
       ORDER BY price ASC, id ASC`,
      [productIds]
    );

    const [inventoryCounts] = await this.pool.query(
      `SELECT variant_id AS variantId, COUNT(*) AS count
       FROM digital_inventory_items
       WHERE status = 'AVAILABLE' AND variant_id IN (?)
       GROUP BY variant_id`,
      [variants.map((v) => v.id).concat([0])]
    );

    const inventoryMap = new Map();
    for (const row of inventoryCounts) {
      inventoryMap.set(row.variantId, row.count);
    }

    const variantsByProduct = new Map();
    for (const v of variants) {
      if (!variantsByProduct.has(v.productId)) {
        variantsByProduct.set(v.productId, []);
      }
      const availableStock = v.stockQuantity === -1 ? 9999 : (inventoryMap.get(v.id) || 0);
      variantsByProduct.get(v.productId).push({
        ...v,
        availableStock
      });
    }

    return products.map((p) => ({
      ...p,
      variants: variantsByProduct.get(p.id) || []
    }));
  }

  async getProductBySlug(slug) {
    const [rows] = await this.pool.query(
      `SELECT id, slug, name, type, category, short_description AS shortDescription, 
              description, thumbnail_url AS thumbnailUrl, badge, is_public AS isPublic, 
              status, sort_order AS sortOrder, created_at AS createdAt
       FROM products 
       WHERE slug = ?`,
      [slug]
    );
    if (!rows.length) return null;

    const product = rows[0];
    const [variants] = await this.pool.query(
      `SELECT id, product_id AS productId, sku, name, price, original_price AS originalPrice,
              currency, duration_days AS durationDays, max_devices AS maxDevices,
              metadata_json AS metadata, stock_quantity AS stockQuantity, is_active AS isActive
       FROM product_variants
       WHERE product_id = ?
       ORDER BY price ASC, id ASC`,
      [product.id]
    );

    return {
      ...product,
      variants
    };
  }

  async getProductById(id) {
    const [rows] = await this.pool.query(
      `SELECT id, slug, name, type, category, short_description AS shortDescription, 
              description, thumbnail_url AS thumbnailUrl, badge, is_public AS isPublic, 
              status, sort_order AS sortOrder, created_at AS createdAt
       FROM products 
       WHERE id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  async getVariantById(variantId) {
    const [rows] = await this.pool.query(
      `SELECT id, product_id AS productId, sku, name, price, original_price AS originalPrice,
              currency, duration_days AS durationDays, max_devices AS maxDevices,
              metadata_json AS metadata, stock_quantity AS stockQuantity, is_active AS isActive
       FROM product_variants
       WHERE id = ?`,
      [variantId]
    );
    return rows[0] || null;
  }

  async createProduct({ slug, name, type = "LICENSE", category = "tools", shortDescription, description, thumbnailUrl, badge, isPublic = true, sortOrder = 0 }) {
    const now = toSqlDate();
    const [result] = await this.pool.query(
      `INSERT INTO products (slug, name, type, category, short_description, description, thumbnail_url, badge, is_public, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [slug, name, type, category, shortDescription, description, thumbnailUrl, badge, isPublic ? 1 : 0, sortOrder, now, now]
    );
    return result.insertId;
  }

  async updateProduct(id, fields) {
    const sets = [];
    const values = [];
    for (const [key, val] of Object.entries(fields)) {
      const sqlCol = {
        name: "name",
        type: "type",
        category: "category",
        shortDescription: "short_description",
        description: "description",
        thumbnailUrl: "thumbnail_url",
        badge: "badge",
        isPublic: "is_public",
        status: "status",
        sortOrder: "sort_order"
      }[key];
      if (sqlCol) {
        sets.push(`${sqlCol} = ?`);
        values.push(val);
      }
    }
    if (!sets.length) return;
    sets.push("updated_at = ?");
    values.push(toSqlDate());
    values.push(id);
    await this.pool.query(`UPDATE products SET ${sets.join(", ")} WHERE id = ?`, values);
  }

  async deleteProduct(id) {
    await this.pool.query("DELETE FROM products WHERE id = ?", [id]);
  }

  async createVariant({ productId, sku, name, price, originalPrice = null, currency = "VND", durationDays = null, maxDevices = 1, metadata = null, stockQuantity = -1, isActive = true }) {
    const now = toSqlDate();
    const [result] = await this.pool.query(
      `INSERT INTO product_variants (product_id, sku, name, price, original_price, currency, duration_days, max_devices, metadata_json, stock_quantity, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId, sku, name, price, originalPrice, currency, durationDays, maxDevices, metadata ? JSON.stringify(metadata) : null, stockQuantity, isActive ? 1 : 0, now, now]
    );
    return result.insertId;
  }

  async updateVariant(id, fields) {
    const sets = [];
    const values = [];
    for (const [key, val] of Object.entries(fields)) {
      const sqlCol = {
        name: "name",
        sku: "sku",
        price: "price",
        originalPrice: "original_price",
        currency: "currency",
        durationDays: "duration_days",
        maxDevices: "max_devices",
        metadata: "metadata_json",
        stockQuantity: "stock_quantity",
        isActive: "is_active"
      }[key];
      if (sqlCol) {
        sets.push(`${sqlCol} = ?`);
        values.push(key === "metadata" && val ? JSON.stringify(val) : val);
      }
    }
    if (!sets.length) return;
    sets.push("updated_at = ?");
    values.push(toSqlDate());
    values.push(id);
    await this.pool.query(`UPDATE product_variants SET ${sets.join(", ")} WHERE id = ?`, values);
  }

  async deleteVariant(id) {
    await this.pool.query("DELETE FROM product_variants WHERE id = ?", [id]);
  }

  async addInventoryItem({ productId, variantId = null, encryptedSecret, iv, authTag, secretLast4 }) {
    const now = toSqlDate();
    const [result] = await this.pool.query(
      `INSERT INTO digital_inventory_items (product_id, variant_id, encrypted_secret, iv, auth_tag, secret_last4, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'AVAILABLE', ?)`,
      [productId, variantId, encryptedSecret, iv, authTag, secretLast4, now]
    );
    return result.insertId;
  }

  async listInventory(productId = null, status = null) {
    let sql = `SELECT i.id, i.product_id AS productId, i.variant_id AS variantId, i.secret_last4 AS secretLast4,
                      i.status, i.order_id AS orderId, i.created_at AS createdAt, i.sold_at AS soldAt,
                      p.name AS productName, v.name AS variantName
               FROM digital_inventory_items i
               LEFT JOIN products p ON p.id = i.product_id
               LEFT JOIN product_variants v ON v.id = i.variant_id
               WHERE 1=1`;
    const params = [];
    if (productId) {
      sql += " AND i.product_id = ?";
      params.push(productId);
    }
    if (status) {
      sql += " AND i.status = ?";
      params.push(status);
    }
    sql += " ORDER BY i.id DESC LIMIT 100";
    const [rows] = await this.pool.query(sql, params);
    return rows;
  }

  async popAvailableInventoryItem(productId, variantId = null, orderId = null, connection = null) {
    const conn = connection || this.pool;
    let sql = `SELECT id, product_id AS productId, variant_id AS variantId, 
                      encrypted_secret AS encryptedSecret, iv, auth_tag AS authTag, secret_last4 AS secretLast4
               FROM digital_inventory_items
               WHERE product_id = ? AND status = 'AVAILABLE'`;
    const params = [productId];
    if (variantId) {
      sql += " AND (variant_id = ? OR variant_id IS NULL)";
      params.push(variantId);
    }
    sql += " ORDER BY id ASC LIMIT 1 FOR UPDATE";

    const [rows] = await conn.query(sql, params);
    if (!rows.length) return null;

    const item = rows[0];
    const now = toSqlDate();
    await conn.query(
      `UPDATE digital_inventory_items
       SET status = 'SOLD', order_id = ?, sold_at = ?
       WHERE id = ?`,
      [orderId, now, item.id]
    );

    return item;
  }

  async createOrder({ orderCode, customerEmail = null, customerName = null, customerPhone = null, totalAmount, paymentMethod = "vietqr", paymentCode = null, transferContent = null, metadata = null, expiredAt }) {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const now = toSqlDate();
      const [orderRes] = await conn.query(
        `INSERT INTO commerce_orders (order_code, customer_email, customer_name, customer_phone, status, currency, total_amount, payment_method, payment_code, transfer_content, metadata_json, created_at, expired_at)
         VALUES (?, ?, ?, ?, 'pending', 'VND', ?, ?, ?, ?, ?, ?, ?)`,
        [orderCode, customerEmail, customerName, customerPhone, totalAmount, paymentMethod, paymentCode, transferContent, metadata ? JSON.stringify(metadata) : null, now, toSqlDate(expiredAt)]
      );
      const orderId = orderRes.insertId;

      await conn.commit();
      return orderId;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async addOrderItem({ orderId, productId, variantId, quantity = 1, unitPrice, totalPrice, fulfillmentType, fulfillmentData = null }) {
    await this.pool.query(
      `INSERT INTO commerce_order_items (order_id, product_id, variant_id, quantity, unit_price, total_price, fulfillment_type, fulfillment_data_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, productId, variantId, quantity, unitPrice, totalPrice, fulfillmentType, fulfillmentData ? JSON.stringify(fulfillmentData) : null]
    );
  }

  async getOrderByCode(orderCode) {
    const [rows] = await this.pool.query(
      `SELECT id, order_code AS orderCode, customer_email AS customerEmail, customer_name AS customerName,
              customer_phone AS customerPhone, status, currency, total_amount AS totalAmount,
              payment_method AS paymentMethod, payment_code AS paymentCode, transfer_content AS transferContent,
              metadata_json AS metadata, created_at AS createdAt, paid_at AS paidAt,
              fulfilled_at AS fulfilledAt, expired_at AS expiredAt
       FROM commerce_orders
       WHERE order_code = ?`,
      [orderCode]
    );
    if (!rows.length) return null;

    const order = rows[0];
    const [items] = await this.pool.query(
      `SELECT oi.id, oi.product_id AS productId, oi.variant_id AS variantId, oi.quantity,
              oi.unit_price AS unitPrice, oi.total_price AS totalPrice, oi.fulfillment_type AS fulfillmentType,
              oi.fulfillment_data_json AS fulfillmentData,
              p.name AS productName, p.type AS productType, p.slug AS productSlug,
              v.name AS variantName, v.sku AS variantSku, v.duration_days AS durationDays
       FROM commerce_order_items oi
       JOIN products p ON p.id = oi.product_id
       JOIN product_variants v ON v.id = oi.variant_id
       WHERE oi.order_id = ?`,
      [order.id]
    );

    const [fulfillments] = await this.pool.query(
      `SELECT id, order_item_id AS orderItemId, fulfillment_type AS fulfillmentType,
              status, delivered_payload_json AS deliveredPayload, completed_at AS completedAt
       FROM fulfillments
       WHERE order_id = ?`,
      [order.id]
    );

    return {
      ...order,
      items,
      fulfillments
    };
  }

  async updateOrderStatus(orderId, status, { paidAt = null, fulfilledAt = null } = {}) {
    const sets = ["status = ?"];
    const values = [status];
    if (paidAt) {
      sets.push("paid_at = ?");
      values.push(toSqlDate(paidAt));
    }
    if (fulfilledAt) {
      sets.push("fulfilled_at = ?");
      values.push(toSqlDate(fulfilledAt));
    }
    values.push(orderId);
    await this.pool.query(`UPDATE commerce_orders SET ${sets.join(", ")} WHERE id = ?`, values);
  }

  async recordFulfillment({ orderId, orderItemId, fulfillmentType, status = "SUCCESS", deliveredPayload = null, errorMessage = null }) {
    const now = toSqlDate();
    const [result] = await this.pool.query(
      `INSERT INTO fulfillments (order_id, order_item_id, fulfillment_type, status, delivered_payload_json, error_message, created_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, orderItemId, fulfillmentType, status, deliveredPayload ? JSON.stringify(deliveredPayload) : null, errorMessage, now, status === "SUCCESS" ? now : null]
    );
    return result.insertId;
  }

  async listAdminOrders({ limit = 50, offset = 0, status = null } = {}) {
    let sql = `SELECT o.id, o.order_code AS orderCode, o.customer_email AS customerEmail,
                      o.customer_name AS customerName, o.status, o.total_amount AS totalAmount,
                      o.payment_method AS paymentMethod, o.transfer_content AS transferContent,
                      o.created_at AS createdAt, o.paid_at AS paidAt, o.fulfilled_at AS fulfilledAt
               FROM commerce_orders o
               WHERE 1=1`;
    const params = [];
    if (status) {
      sql += " AND o.status = ?";
      params.push(status);
    }
    sql += " ORDER BY o.id DESC LIMIT ? OFFSET ?";
    params.push(Number(limit), Number(offset));

    const [rows] = await this.pool.query(sql, params);
    return rows;
  }

  async createCardTransaction({ transactionCode, telco, declaredAmount, serial, pin, customerContact = null }) {
    const now = toSqlDate();
    const [res] = await this.pool.query(
      `INSERT INTO card_transactions (transaction_code, telco, declared_amount, serial, pin, status, customer_contact, created_at)
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
      [transactionCode, telco, declaredAmount, serial, pin, customerContact, now]
    );
    return res.insertId;
  }

  async listRecentActivity(limit = 8) {
    const [rows] = await this.pool.query(
      `SELECT o.order_code AS code, p.name AS productName, o.total_amount AS amount, 
              o.fulfilled_at AS time, 'ORDER' AS type
       FROM commerce_orders o
       JOIN commerce_order_items oi ON oi.order_id = o.id
       JOIN products p ON p.id = oi.product_id
       WHERE o.status = 'fulfilled'
       ORDER BY o.id DESC LIMIT ?`,
      [Number(limit)]
    );
    return rows;
  }
}
