import { Router } from "express";
import { z } from "zod";
import { hashLicenseKey, displayPartsForKey, normalizeLicenseKey } from "../utils/token.js";
import { isoNow } from "../utils/time.js";
import { safeEqualSecret } from "../utils/crypto.js";
import { maskInstallationId } from "../utils/admin-auth.js";

const provisionSchema = z.object({
  rawKey: z.string().min(10).max(100),
  plan: z.string().min(1).max(32).default("pro"),
  maxDevices: z.number().int().min(1).max(10000).default(1),
  expiresAt: z.string().nullable().optional(),
  durationDays: z.number().int().optional(),
  customerNote: z.string().max(255).optional()
});

const revokeSchema = z.object({
  rawKey: z.string().optional(),
  keyHash: z.string().optional(),
  reason: z.string().max(255).optional()
}).refine(data => data.rawKey || data.keyHash, {
  message: "Either rawKey or keyHash must be provided"
});

const extendSchema = z.object({
  rawKey: z.string().optional(),
  keyHash: z.string().optional(),
  daysToAdd: z.number().int().min(1).max(3650),
  newExpiresAt: z.string().nullable().optional()
}).refine(data => data.rawKey || data.keyHash, {
  message: "Either rawKey or keyHash must be provided"
});

const keyRefSchema = z.object({
  rawKey: z.string().max(100).optional(),
  keyHash: z.string().max(128).optional()
}).refine(data => data.rawKey || data.keyHash, {
  message: "Either rawKey or keyHash must be provided"
});

const resetDevicesSchema = z.object({
  rawKey: z.string().max(100).optional(),
  keyHash: z.string().max(128).optional(),
  // Bỏ trống = reset tất cả thiết bị đang hoạt động của key
  deviceId: z.number().int().positive().optional()
}).refine(data => data.rawKey || data.keyHash, {
  message: "Either rawKey or keyHash must be provided"
});

function toDeviceView(d) {
  return {
    id: Number(d.id),
    installationId: maskInstallationId(d.installation_id),
    deviceName: d.device_name || null,
    platform: d.platform || null,
    executor: d.executor || null,
    clientVersion: d.client_version || null,
    firstActivatedAt: d.first_activated_at ? new Date(d.first_activated_at).toISOString() : null,
    lastSeenAt: d.last_seen_at ? new Date(d.last_seen_at).toISOString() : null
  };
}

export function createInternalRouter({ licenseRepository, config }) {
  const router = Router();
  const internalApiKey = config.internalApiKey || process.env.INTERNAL_API_KEY || "";

  // Middleware verify Internal API Key
  const verifyInternalAuth = (req, res, next) => {
    const providedKey = req.headers["x-internal-api-key"] || req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
    
    // In production, internalApiKey must be configured and match
    if (!internalApiKey) {
      if (config.nodeEnv === "production") {
        return res.status(500).json({ ok: false, message: "Internal API Key not configured on server" });
      }
      return next();
    }

    if (!safeEqualSecret(String(providedKey || ""), internalApiKey)) {
      return res.status(401).json({ ok: false, message: "Unauthorized: Invalid or missing internal API key" });
    }
    next();
  };

  router.use(verifyInternalAuth);

  // Health check for Shop M2M
  router.get("/health", (_req, res) => {
    res.json({ ok: true, service: "license-internal-m2m", time: isoNow() });
  });

  // Provision / Sync new License from Shop
  router.post("/licenses/provision", async (req, res, next) => {
    try {
      const parsed = provisionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ ok: false, message: parsed.error.errors[0]?.message || "Invalid payload" });
      }

      const { rawKey, plan, maxDevices, expiresAt, durationDays } = parsed.data;
      const normalizedKey = normalizeLicenseKey(rawKey);
      const pepper = config.license?.keyPepper || process.env.LICENSE_KEY_PEPPER;
      const keyHash = hashLicenseKey(normalizedKey, pepper);
      const { prefix, last4 } = displayPartsForKey(normalizedKey);

      let finalExpiresAt = expiresAt ? new Date(expiresAt) : null;
      if (!finalExpiresAt && durationDays && durationDays > 0) {
        finalExpiresAt = new Date(Date.now() + durationDays * 86400000);
      }

      // Upsert into licenses table
      const pool = licenseRepository.pool;
      const sql = `
        INSERT INTO licenses (
          license_key_hash, license_key_prefix, license_key_last4, plan, status,
          max_devices, expires_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'active', ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE 
          status = 'active',
          plan = VALUES(plan),
          max_devices = VALUES(max_devices),
          expires_at = VALUES(expires_at),
          updated_at = NOW()
      `;

      await pool.query(sql, [keyHash, prefix, last4, plan, maxDevices, finalExpiresAt]);

      return res.json({
        ok: true,
        message: "License provisioned and synced successfully",
        data: {
          keyPrefix: prefix,
          keyLast4: last4,
          plan,
          maxDevices,
          expiresAt: finalExpiresAt ? finalExpiresAt.toISOString() : null,
          status: "active"
        }
      });
    } catch (err) {
      next(err);
    }
  });

  // Revoke License (and invalidate all active device tokens)
  router.post("/licenses/revoke", async (req, res, next) => {
    try {
      const parsed = revokeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ ok: false, message: parsed.error.errors[0]?.message || "Invalid payload" });
      }

      const { rawKey, keyHash: providedHash } = parsed.data;
      const pepper = config.license?.keyPepper || process.env.LICENSE_KEY_PEPPER;
      // Ưu tiên rawKey: keyHash do Shop gửi được tính bằng pepper của Shop, không khớp DB này.
      const keyHash = rawKey ? hashLicenseKey(normalizeLicenseKey(rawKey), pepper) : providedHash;

      const pool = licenseRepository.pool;

      // Find license
      const [rows] = await pool.query("SELECT id FROM licenses WHERE license_key_hash = ? LIMIT 1", [keyHash]);
      if (rows.length === 0) {
        return res.status(404).json({ ok: false, message: "License not found in authority DB" });
      }
      const licenseId = rows[0].id;

      // Update license status
      await pool.query(
        "UPDATE licenses SET status = 'revoked', updated_at = NOW() WHERE id = ?",
        [licenseId]
      );

      // Invalidate all tokens for this license
      await pool.query(
        "DELETE FROM license_tokens WHERE license_id = ?",
        [licenseId]
      );

      // Revoke all devices (license_devices không có cột status; thu hồi bằng revoked_at)
      await licenseRepository.revokeAllDevicesForLicense(licenseId);

      return res.json({
        ok: true,
        message: "License revoked and all active device sessions invalidated successfully",
        licenseId
      });
    } catch (err) {
      next(err);
    }
  });

  const findLicenseForRef = async ({ rawKey, keyHash }) => {
    const pepper = config.license?.keyPepper || process.env.LICENSE_KEY_PEPPER;
    const hash = rawKey ? hashLicenseKey(normalizeLicenseKey(rawKey), pepper) : keyHash;
    return licenseRepository.findLicenseByKeyHash(hash);
  };

  // Xem thiết bị đang dùng 1 key (cho admin Shop)
  router.post("/licenses/devices", async (req, res, next) => {
    try {
      const parsed = keyRefSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ ok: false, message: parsed.error.errors[0]?.message || "Invalid payload" });
      }
      const license = await findLicenseForRef(parsed.data);
      if (!license) {
        return res.status(404).json({ ok: false, message: "License not found in authority DB" });
      }
      const devices = await licenseRepository.listActiveDevicesForLicense(license.id);
      return res.json({
        ok: true,
        license: {
          status: license.status,
          plan: license.plan,
          maxDevices: Number(license.max_devices),
          expiresAt: license.expires_at ? new Date(license.expires_at).toISOString() : null,
          activeDevices: devices.length
        },
        devices: devices.map(toDeviceView)
      });
    } catch (err) {
      next(err);
    }
  });

  // Reset thiết bị: thu hồi 1 máy (deviceId) hoặc tất cả, để khách kích hoạt lại trên máy mới
  router.post("/licenses/devices/reset", async (req, res, next) => {
    try {
      const parsed = resetDevicesSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ ok: false, message: parsed.error.errors[0]?.message || "Invalid payload" });
      }
      const license = await findLicenseForRef(parsed.data);
      if (!license) {
        return res.status(404).json({ ok: false, message: "License not found in authority DB" });
      }

      const { deviceId } = parsed.data;
      let revoked = 0;
      if (deviceId) {
        const devices = await licenseRepository.listActiveDevicesForLicense(license.id);
        if (!devices.some((d) => Number(d.id) === deviceId)) {
          return res.status(404).json({ ok: false, message: "Device not found or already reset for this license" });
        }
        await licenseRepository.revokeDeviceAndTokens(deviceId);
        revoked = 1;
      } else {
        revoked = (await licenseRepository.listActiveDevicesForLicense(license.id)).length;
        await licenseRepository.revokeAllDevicesForLicense(license.id);
      }

      await licenseRepository.insertEvent({
        licenseId: license.id,
        deviceId: deviceId || null,
        eventType: "device_reset_by_shop",
        metadata: { scope: deviceId ? "single" : "all", revoked, source: "shop_admin" }
      }).catch(() => {});

      return res.json({ ok: true, revoked, message: deviceId ? "Device reset" : "All devices reset" });
    } catch (err) {
      next(err);
    }
  });

  // Extend License Expiry
  router.post("/licenses/extend", async (req, res, next) => {
    try {
      const parsed = extendSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ ok: false, message: parsed.error.errors[0]?.message || "Invalid payload" });
      }

      const { rawKey, keyHash: providedHash, daysToAdd, newExpiresAt } = parsed.data;
      const pepper = config.license?.keyPepper || process.env.LICENSE_KEY_PEPPER;
      // Ưu tiên rawKey: keyHash do Shop gửi được tính bằng pepper của Shop, không khớp DB này.
      const keyHash = rawKey ? hashLicenseKey(normalizeLicenseKey(rawKey), pepper) : providedHash;

      const pool = licenseRepository.pool;
      const [rows] = await pool.query("SELECT id, expires_at FROM licenses WHERE license_key_hash = ? LIMIT 1", [keyHash]);
      if (rows.length === 0) {
        return res.status(404).json({ ok: false, message: "License not found in authority DB" });
      }

      const lic = rows[0];
      let finalDate = newExpiresAt ? new Date(newExpiresAt) : null;
      if (!finalDate) {
        let base = lic.expires_at && new Date(lic.expires_at) > new Date() ? new Date(lic.expires_at) : new Date();
        base.setDate(base.getDate() + daysToAdd);
        finalDate = base;
      }

      await pool.query(
        "UPDATE licenses SET expires_at = ?, status = 'active', updated_at = NOW() WHERE id = ?",
        [finalDate, lic.id]
      );

      return res.json({
        ok: true,
        message: `License extended by ${daysToAdd} days`,
        licenseId: lic.id,
        expiresAt: finalDate.toISOString()
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
