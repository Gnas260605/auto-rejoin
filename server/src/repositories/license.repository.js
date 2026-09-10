import { mysqlDate, nowDate } from "../utils/time.js";

export class LicenseRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async withTransaction(work) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const transactionalRepo = new LicenseRepository(connection);
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

  async findLicenseByKeyHashForUpdate(keyHash) {
    const [rows] = await this.pool.execute(
      "SELECT * FROM licenses WHERE license_key_hash = ? FOR UPDATE",
      [keyHash]
    );
    return rows[0] || null;
  }

  async findDeviceByInstallationId(licenseId, installationId) {
    const [rows] = await this.pool.execute(
      "SELECT * FROM license_devices WHERE license_id = ? AND installation_id = ?",
      [licenseId, installationId]
    );
    return rows[0] || null;
  }

  async countActiveDevicesForLicense(licenseId) {
    const [rows] = await this.pool.execute(
      "SELECT COUNT(*) AS count FROM license_devices WHERE license_id = ? AND revoked_at IS NULL",
      [licenseId]
    );
    return Number(rows[0]?.count || 0);
  }

  async createDevice(fields) {
    const now = mysqlDate(nowDate());
    const [result] = await this.pool.execute(
      `INSERT INTO license_devices
        (license_id, installation_id, device_name, platform, executor, client_version,
         first_activated_at, last_seen_at, revoked_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
      [
        fields.licenseId,
        fields.installationId,
        fields.deviceName || null,
        fields.platform || null,
        fields.executor || null,
        fields.clientVersion || null,
        now,
        now,
        now,
        now
      ]
    );
    return {
      id: result.insertId,
      license_id: fields.licenseId,
      installation_id: fields.installationId,
      platform: fields.platform || null,
      executor: fields.executor || null,
      revoked_at: null
    };
  }

  async updateDeviceSeen(deviceId, fields = {}) {
    await this.pool.execute(
      `UPDATE license_devices
       SET last_seen_at = UTC_TIMESTAMP(),
           platform = COALESCE(?, platform),
           executor = COALESCE(?, executor),
           client_version = COALESCE(?, client_version),
           revoked_at = NULL,
           updated_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [fields.platform || null, fields.executor || null, fields.clientVersion || null, deviceId]
    );
  }

  async createToken(fields) {
    const [result] = await this.pool.execute(
      `INSERT INTO license_tokens
        (license_id, device_id, token_hash, expires_at, revoked_at, last_used_at, created_at)
       VALUES (?, ?, ?, ?, NULL, NULL, UTC_TIMESTAMP())`,
      [fields.licenseId, fields.deviceId, fields.tokenHash, mysqlDate(fields.expiresAt)]
    );
    return result.insertId;
  }

  async findTokenBundleByHash(tokenHash) {
    const [rows] = await this.pool.execute(
      `SELECT
         t.id AS token_id, t.token_hash, t.expires_at AS token_expires_at,
         t.revoked_at AS token_revoked_at, t.last_used_at,
         d.id AS device_id, d.installation_id, d.revoked_at AS device_revoked_at,
         l.id AS license_id, l.plan, l.status, l.max_devices, l.expires_at AS license_expires_at
       FROM license_tokens t
       JOIN license_devices d ON d.id = t.device_id
       JOIN licenses l ON l.id = t.license_id
       WHERE t.token_hash = ?
       LIMIT 1`,
      [tokenHash]
    );
    return rows[0] || null;
  }

  async touchTokenAndDevice(tokenId, deviceId) {
    await this.pool.execute("UPDATE license_tokens SET last_used_at = UTC_TIMESTAMP() WHERE id = ?", [tokenId]);
    await this.pool.execute(
      "UPDATE license_devices SET last_seen_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP() WHERE id = ?",
      [deviceId]
    );
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

  async insertEvent(fields) {
    await this.pool.execute(
      `INSERT INTO license_events
        (license_id, device_id, event_type, ip_address, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
      [
        fields.licenseId || null,
        fields.deviceId || null,
        fields.eventType,
        fields.ipAddress || null,
        fields.metadata ? JSON.stringify(fields.metadata) : null
      ]
    );
  }

  async createLicense(fields) {
    const now = mysqlDate(nowDate());
    const [result] = await this.pool.execute(
      `INSERT INTO licenses
        (license_key_hash, license_key_prefix, license_key_last4, plan, status, max_devices, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
      [
        fields.keyHash,
        fields.keyPrefix,
        fields.keyLast4,
        fields.plan,
        fields.maxDevices,
        fields.expiresAt ? mysqlDate(fields.expiresAt) : null,
        now,
        now
      ]
    );
    return result.insertId;
  }
}
