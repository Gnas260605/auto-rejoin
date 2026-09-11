import { mysqlDate, nowDate } from "../utils/time.js";

export class AdminRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async withTransaction(work) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const transactionalRepo = new AdminRepository(connection);
      const result = await work(transactionalRepo);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ── Admin User Queries ──────────────────────────────────────────────
  async findAdminByUsername(username) {
    const [rows] = await this.pool.execute(
      "SELECT * FROM admin_users WHERE username = ?",
      [username]
    );
    return rows[0] || null;
  }

  async findAdminById(id) {
    const [rows] = await this.pool.execute(
      "SELECT id, username, role, status, last_login_at, created_at, updated_at FROM admin_users WHERE id = ?",
      [id]
    );
    return rows[0] || null;
  }

  async createAdminUser(fields) {
    const now = mysqlDate(nowDate());
    const [result] = await this.pool.execute(
      `INSERT INTO admin_users (username, password_hash, role, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        fields.username,
        fields.passwordHash,
        fields.role || "admin",
        fields.status || "active",
        now,
        now
      ]
    );
    return result.insertId;
  }

  async updateAdminPassword(adminId, passwordHash) {
    await this.pool.execute(
      "UPDATE admin_users SET password_hash = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?",
      [passwordHash, adminId]
    );
  }

  async updateAdminLastLogin(adminId) {
    await this.pool.execute(
      "UPDATE admin_users SET last_login_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP() WHERE id = ?",
      [adminId]
    );
  }

  // ── Audit Events ───────────────────────────────────────────────────
  async insertAudit(fields) {
    await this.pool.execute(
      `INSERT INTO admin_audit_events
        (admin_user_id, action, target_type, target_id, ip_address, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
      [
        fields.adminUserId || null,
        fields.action,
        fields.targetType,
        fields.targetId ? String(fields.targetId) : null,
        fields.ipAddress || null,
        fields.metadata ? JSON.stringify(fields.metadata) : null
      ]
    );
  }

  async listAudits({ page = 1, limit = 20, action, targetType } = {}) {
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const safePage = Math.max(1, page);
    const offset = (safePage - 1) * safeLimit;

    const conditions = [];
    const params = [];

    if (action) {
      conditions.push("a.action = ?");
      params.push(action);
    }
    if (targetType) {
      conditions.push("a.target_type = ?");
      params.push(targetType);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [countRows] = await this.pool.execute(
      `SELECT COUNT(*) AS total FROM admin_audit_events a ${whereClause}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await this.pool.execute(
      `SELECT a.id, a.admin_user_id, u.username AS admin_username, a.action,
              a.target_type, a.target_id, a.ip_address, a.metadata_json, a.created_at
       FROM admin_audit_events a
       LEFT JOIN admin_users u ON u.id = a.admin_user_id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT ${Number(safeLimit)} OFFSET ${Number(offset)}`,
      params
    );

    return {
      items: rows,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1
    };
  }

  // ── License Management ─────────────────────────────────────────────
  async listLicenses({ page = 1, limit = 20, search, status, plan, salesChannel, expiringSoonDays } = {}) {
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const safePage = Math.max(1, page);
    const offset = (safePage - 1) * safeLimit;

    const conditions = [];
    const params = [];

    if (search) {
      const cleanSearch = String(search).trim();
      conditions.push("(l.license_key_prefix LIKE ? OR l.license_key_last4 LIKE ? OR l.customer_name LIKE ? OR l.customer_contact LIKE ? OR l.id = ?)");
      params.push(`%${cleanSearch}%`, `%${cleanSearch}%`, `%${cleanSearch}%`, `%${cleanSearch}%`, Number(cleanSearch) || 0);
    }

    if (status) {
      conditions.push("l.status = ?");
      params.push(status);
    }

    if (plan) {
      conditions.push("l.plan = ?");
      params.push(plan);
    }

    if (salesChannel) {
      conditions.push("l.sales_channel = ?");
      params.push(salesChannel);
    }

    if (expiringSoonDays && Number.isInteger(Number(expiringSoonDays))) {
      conditions.push(
        "l.expires_at IS NOT NULL AND l.expires_at > UTC_TIMESTAMP() AND l.expires_at <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY)"
      );
      params.push(Number(expiringSoonDays));
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [countRows] = await this.pool.execute(
      `SELECT COUNT(*) AS total FROM licenses l ${whereClause}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await this.pool.execute(
      `SELECT
         l.id,
         l.license_key_prefix,
         l.license_key_last4,
         l.plan,
         l.status,
         l.max_devices,
         l.expires_at,
         l.customer_name,
         l.customer_contact,
         l.sales_channel,
         l.customer_note,
         l.created_at,
         l.updated_at,
         (SELECT COUNT(*) FROM license_devices d WHERE d.license_id = l.id AND d.revoked_at IS NULL) AS active_devices_count
       FROM licenses l
       ${whereClause}
       ORDER BY l.id DESC
       LIMIT ${Number(safeLimit)} OFFSET ${Number(offset)}`,
      params
    );

    return {
      items: rows,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1
    };
  }

  async findLicenseById(id) {
    const [rows] = await this.pool.execute(
      `SELECT
         l.id,
         l.license_key_prefix,
         l.license_key_last4,
         l.plan,
         l.status,
         l.max_devices,
         l.expires_at,
         l.customer_name,
         l.customer_contact,
         l.sales_channel,
         l.customer_note,
         l.created_at,
         l.updated_at,
         (SELECT COUNT(*) FROM license_devices d WHERE d.license_id = l.id AND d.revoked_at IS NULL) AS active_devices_count
       FROM licenses l
       WHERE l.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  async updateLicense(id, fields) {
    const updates = [];
    const params = [];

    if (fields.plan !== undefined) {
      updates.push("plan = ?");
      params.push(fields.plan);
    }
    if (fields.maxDevices !== undefined) {
      updates.push("max_devices = ?");
      params.push(fields.maxDevices);
    }
    if (fields.expiresAt !== undefined) {
      updates.push("expires_at = ?");
      params.push(fields.expiresAt ? mysqlDate(fields.expiresAt) : null);
    }

    if (updates.length === 0) {
      return;
    }

    updates.push("updated_at = UTC_TIMESTAMP()");
    params.push(id);

    await this.pool.execute(
      `UPDATE licenses SET ${updates.join(", ")} WHERE id = ?`,
      params
    );
  }

  async updateLicenseStatus(id, status) {
    await this.pool.execute(
      "UPDATE licenses SET status = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?",
      [status, id]
    );
  }

  async extendLicense(id, days) {
    await this.pool.execute(
      `UPDATE licenses
       SET expires_at = DATE_ADD(GREATEST(COALESCE(expires_at, UTC_TIMESTAMP()), UTC_TIMESTAMP()), INTERVAL ? DAY),
           updated_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [days, id]
    );
  }

  async revokeAllTokensForLicense(licenseId) {
    await this.pool.execute(
      "UPDATE license_tokens SET revoked_at = UTC_TIMESTAMP() WHERE license_id = ? AND revoked_at IS NULL",
      [licenseId]
    );
  }

  // ── Device Management ──────────────────────────────────────────────
  async listDevicesForLicense(licenseId, { page = 1, limit = 50 } = {}) {
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const safePage = Math.max(1, page);
    const offset = (safePage - 1) * safeLimit;

    const [countRows] = await this.pool.execute(
      "SELECT COUNT(*) AS total FROM license_devices WHERE license_id = ?",
      [licenseId]
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await this.pool.execute(
      `SELECT
         id, license_id, installation_id, device_name, platform, executor, client_version,
         first_activated_at, last_seen_at, revoked_at, created_at, updated_at
       FROM license_devices
       WHERE license_id = ?
       ORDER BY revoked_at IS NULL DESC, last_seen_at DESC
       LIMIT ${Number(safeLimit)} OFFSET ${Number(offset)}`,
      [licenseId]
    );

    return {
      items: rows,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1
    };
  }

  async findDeviceById(licenseId, deviceId) {
    const [rows] = await this.pool.execute(
      "SELECT * FROM license_devices WHERE license_id = ? AND id = ?",
      [licenseId, deviceId]
    );
    return rows[0] || null;
  }

  async revokeDeviceAndTokens(deviceId) {
    await this.pool.execute(
      "UPDATE license_devices SET revoked_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP() WHERE id = ?",
      [deviceId]
    );
    await this.pool.execute(
      "UPDATE license_tokens SET revoked_at = UTC_TIMESTAMP() WHERE device_id = ? AND revoked_at IS NULL",
      [deviceId]
    );
  }

  // ── License Events ─────────────────────────────────────────────────
  async listEventsForLicense(licenseId, { page = 1, limit = 20 } = {}) {
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const safePage = Math.max(1, page);
    const offset = (safePage - 1) * safeLimit;

    const [countRows] = await this.pool.execute(
      "SELECT COUNT(*) AS total FROM license_events WHERE license_id = ?",
      [licenseId]
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await this.pool.execute(
      `SELECT e.id, e.license_id, e.device_id, e.event_type, e.ip_address, e.metadata_json, e.created_at,
              d.installation_id, d.platform, d.executor
       FROM license_events e
       LEFT JOIN license_devices d ON d.id = e.device_id
       WHERE e.license_id = ?
       ORDER BY e.created_at DESC
       LIMIT ${Number(safeLimit)} OFFSET ${Number(offset)}`,
      [licenseId]
    );

    return {
      items: rows,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1
    };
  }

  // ── Dashboard Stats ────────────────────────────────────────────────
  async getDashboardStats() {
    const [totalRows] = await this.pool.execute("SELECT COUNT(*) AS count FROM licenses");
    const [activeRows] = await this.pool.execute("SELECT COUNT(*) AS count FROM licenses WHERE status = 'active'");
    const [suspendedRows] = await this.pool.execute("SELECT COUNT(*) AS count FROM licenses WHERE status = 'suspended'");
    const [revokedRows] = await this.pool.execute("SELECT COUNT(*) AS count FROM licenses WHERE status = 'revoked'");
    const [expiredRows] = await this.pool.execute(
      "SELECT COUNT(*) AS count FROM licenses WHERE status = 'expired' OR (status = 'active' AND expires_at IS NOT NULL AND expires_at < UTC_TIMESTAMP())"
    );
    const [expiringSoonRows] = await this.pool.execute(
      `SELECT COUNT(*) AS count FROM licenses
       WHERE status = 'active' AND expires_at IS NOT NULL
         AND expires_at > UTC_TIMESTAMP()
         AND expires_at <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 DAY)`
    );
    const [activeDevicesRows] = await this.pool.execute(
      "SELECT COUNT(*) AS count FROM license_devices WHERE revoked_at IS NULL"
    );

    return {
      total: Number(totalRows[0]?.count || 0),
      active: Number(activeRows[0]?.count || 0),
      suspended: Number(suspendedRows[0]?.count || 0),
      revoked: Number(revokedRows[0]?.count || 0),
      expired: Number(expiredRows[0]?.count || 0),
      expiringSoon: Number(expiringSoonRows[0]?.count || 0),
      activeDevices: Number(activeDevicesRows[0]?.count || 0)
    };
  }

  // ── System Settings ────────────────────────────────────────────────
  async getSystemSetting(key) {
    const [rows] = await this.pool.execute(
      "SELECT setting_value FROM system_settings WHERE setting_key = ?",
      [key]
    );
    if (!rows || rows.length === 0) return null;
    const val = rows[0].setting_value;
    return typeof val === "string" ? JSON.parse(val) : val;
  }

  async setSystemSetting(key, value) {
    const jsonStr = JSON.stringify(value);
    await this.pool.execute(
      `INSERT INTO system_settings (setting_key, setting_value, updated_at)
       VALUES (?, ?, UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = UTC_TIMESTAMP()`,
      [key, jsonStr, jsonStr]
    );
    return true;
  }
}

