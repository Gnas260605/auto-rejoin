import {
  ADMIN_AUDIT_ACTIONS,
  ADMIN_STATUSES
} from "../constants/admin.js";
import {
  LICENSE_STATUSES,
  DEFAULT_PRICING_PLANS,
  PLAN_ENTITLEMENTS
} from "../constants/license.js";
import {
  comparePassword,
  maskInstallationId,
  signAdminToken
} from "../utils/admin-auth.js";
import {
  displayPartsForKey,
  generateLicenseKey,
  hashLicenseKey
} from "../utils/token.js";
import { secondsFromNow } from "../utils/time.js";

export class AdminServiceError extends Error {
  constructor(code, message, httpStatus = 400) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function resolveLicenseExpiry(data = {}) {
  if (data.expiresInHours !== undefined && data.expiresInHours !== null) {
    const hours = Number(data.expiresInHours);
    if (!Number.isInteger(hours) || hours < 1 || hours > 87600) {
      throw new AdminServiceError("INVALID_EXPIRY", "expiresInHours must be between 1 and 87600", 400);
    }
    return {
      expiresAt: secondsFromNow(hours * 3600),
      expiresInHours: hours,
      expiresInDays: null
    };
  }

  if (data.expiresInDays !== undefined && data.expiresInDays !== null) {
    const days = Number(data.expiresInDays);
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      throw new AdminServiceError("INVALID_EXPIRY", "expiresInDays must be between 1 and 3650", 400);
    }
    return {
      expiresAt: secondsFromNow(days * 86400),
      expiresInHours: null,
      expiresInDays: days
    };
  }

  if (data.expiresAt) {
    const date = new Date(data.expiresAt);
    if (Number.isNaN(date.getTime())) {
      throw new AdminServiceError("INVALID_EXPIRY", "Invalid expiresAt date format", 400);
    }
    return {
      expiresAt: date,
      expiresInHours: null,
      expiresInDays: null
    };
  }

  return {
    expiresAt: null,
    expiresInHours: null,
    expiresInDays: null
  };
}

function formatExpiryText({ expiresAt, expiresInHours, expiresInDays }) {
  if (!expiresAt) {
    return "Vinh vien";
  }
  if (expiresInHours) {
    return `${expiresInHours} gio (Het han: ${expiresAt.toLocaleString("vi-VN")})`;
  }
  if (expiresInDays) {
    return `${expiresInDays} ngay (Het han: ${expiresAt.toLocaleDateString("vi-VN")})`;
  }
  return expiresAt.toLocaleString("vi-VN");
}

function buildAllInOneCommand({ domain, placeId, rawKey }) {
  const apiBase = String(domain || "http://localhost:3000").replace(/\/$/, "");
  const targetPlaceId = String(placeId || "107778070777162").trim();
  return `cd ~; rm -rf auto-rejoin; mkdir -p auto-rejoin; cd auto-rejoin; curl -fSL https://raw.githubusercontent.com/Gnas260605/auto-rejoin/main/setup.sh -o setup.sh; AUTO_REJOIN_LICENSE_API="${apiBase}" AUTO_REJOIN_LICENSE_MODE=required LICENSE_KEY="${rawKey}" JOIN_LOW_SERVER=true LOW_SERVER_MIN_PLAYERS=0 LOW_SERVER_MAX_PLAYERS=2 LOW_SERVER_STRICT=true bash setup.sh ${targetPlaceId}`;
}

export class AdminService {
  constructor({ adminRepository, licenseRepository, config }) {
    this.adminRepo = adminRepository;
    this.licenseRepo = licenseRepository;
    this.config = config;
  }

  // ── Authentication ──────────────────────────────────────────────────
  async login({ username, password }, context = {}) {
    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
      throw new AdminServiceError("INVALID_CREDENTIALS", "Invalid credentials", 401);
    }

    const cleanUsername = username.trim();
    const admin = await this.adminRepo.findAdminByUsername(cleanUsername);
    if (!admin) {
      await this.adminRepo.insertAudit({
        adminUserId: null,
        action: ADMIN_AUDIT_ACTIONS.ADMIN_LOGIN_FAILED,
        targetType: "auth",
        targetId: cleanUsername,
        ipAddress: context.ip,
        metadata: { reason: "user_not_found" }
      });
      throw new AdminServiceError("INVALID_CREDENTIALS", "Invalid credentials", 401);
    }

    const passwordMatches = await comparePassword(password, admin.password_hash);
    if (!passwordMatches) {
      await this.adminRepo.insertAudit({
        adminUserId: admin.id,
        action: ADMIN_AUDIT_ACTIONS.ADMIN_LOGIN_FAILED,
        targetType: "auth",
        targetId: cleanUsername,
        ipAddress: context.ip,
        metadata: { reason: "password_mismatch" }
      });
      throw new AdminServiceError("INVALID_CREDENTIALS", "Invalid credentials", 401);
    }

    if (admin.status === ADMIN_STATUSES.DISABLED) {
      throw new AdminServiceError("ADMIN_DISABLED", "Admin account is disabled", 403);
    }

    await this.adminRepo.updateAdminLastLogin(admin.id);

    const token = signAdminToken(admin, this.config.admin.jwtSecret, this.config.admin.tokenTtlSeconds);

    await this.adminRepo.insertAudit({
      adminUserId: admin.id,
      action: ADMIN_AUDIT_ACTIONS.ADMIN_LOGIN_SUCCESS,
      targetType: "auth",
      targetId: cleanUsername,
      ipAddress: context.ip
    });

    return {
      admin: {
        id: admin.id,
        username: admin.username,
        role: admin.role
      },
      token
    };
  }

  async logout(adminId, context = {}) {
    if (adminId) {
      await this.adminRepo.insertAudit({
        adminUserId: adminId,
        action: ADMIN_AUDIT_ACTIONS.ADMIN_LOGOUT,
        targetType: "auth",
        targetId: String(adminId),
        ipAddress: context.ip
      });
    }
    return { ok: true };
  }

  async getMe(adminId) {
    const admin = await this.adminRepo.findAdminById(adminId);
    if (!admin) {
      throw new AdminServiceError("ADMIN_NOT_FOUND", "Admin not found", 404);
    }
    return {
      id: admin.id,
      username: admin.username,
      role: admin.role,
      status: admin.status,
      lastLoginAt: admin.last_login_at
    };
  }

  // ── Meta & Stats ────────────────────────────────────────────────────
  getPlans() {
    return Object.entries(PLAN_ENTITLEMENTS).map(([plan, data]) => ({
      plan,
      maxInstances: data.maxInstances,
      features: data.features
    }));
  }

  async getPricingSettings() {
    const plans = await this.adminRepo.getSystemSetting("pricing_plans");
    if (!plans || !Array.isArray(plans)) {
      return this.getDefaultPricingPlans();
    }
    return plans;
  }

  getDefaultPricingPlans() {
    return DEFAULT_PRICING_PLANS.map((plan) => ({
      ...plan,
      features: [...plan.features]
    }));
  }

  async updatePricingSettings(plans, adminContext = {}) {
    if (!Array.isArray(plans) || plans.length === 0) {
      throw new AdminServiceError("INVALID_PLANS", "Plans must be a non-empty array", 400);
    }

    // Format & validate each plan
    const sanitizedPlans = plans.map((p) => {
      const priceNum = Number(p.priceNumber) || 0;
      return {
        id: String(p.id || "").trim() || "plan",
        name: String(p.name || "").trim() || "Gói cước",
        badge: p.badge ? String(p.badge).trim() : null,
        duration: String(p.duration || "").trim() || "30 ngày",
        priceNumber: Math.max(0, priceNum),
        priceFormatted: priceNum.toLocaleString("vi-VN"),
        plan: String(p.plan || "pro"),
        maxDevices: Math.max(1, Number(p.maxDevices) || 1),
        enabled: p.enabled !== false,
        highlight: Boolean(p.highlight),
        description: String(p.description || "").trim(),
        features: Array.isArray(p.features) ? p.features.map(f => String(f).trim()).filter(Boolean) : []
      };
    });

    await this.adminRepo.setSystemSetting("pricing_plans", sanitizedPlans);

    await this.adminRepo.insertAudit({
      adminUserId: adminContext.adminId,
      action: "pricing_updated",
      targetType: "settings",
      targetId: "pricing_plans",
      ipAddress: adminContext.ip,
      metadata: { planCount: sanitizedPlans.length }
    });

    return sanitizedPlans;
  }

  async getStats() {
    return this.adminRepo.getDashboardStats();
  }

  // ── License Management ──────────────────────────────────────────────
  async listLicenses(query = {}) {
    const result = await this.adminRepo.listLicenses({
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 20,
      search: query.search,
      status: query.status,
      plan: query.plan,
      expiringSoonDays: query.expiringSoon ? 7 : undefined
    });

    const items = result.items.map((lic) => {
      const entitlements = PLAN_ENTITLEMENTS[lic.plan] || PLAN_ENTITLEMENTS.basic;
      return {
        id: lic.id,
        displayKey: `${lic.license_key_prefix}••••••••••••${lic.license_key_last4}`,
        prefix: lic.license_key_prefix,
        last4: lic.license_key_last4,
        plan: lic.plan,
        status: lic.status,
        maxDevices: Number(lic.max_devices),
        maxInstances: entitlements.maxInstances,
        features: entitlements.features,
        activeDeviceCount: Number(lic.active_devices_count || 0),
        customerName: lic.customer_name || null,
        customerContact: lic.customer_contact || null,
        salesChannel: lic.sales_channel || "direct",
        customerNote: lic.customer_note || null,
        expiresAt: lic.expires_at ? new Date(lic.expires_at).toISOString() : null,
        createdAt: new Date(lic.created_at).toISOString(),
        updatedAt: new Date(lic.updated_at).toISOString()
      };
    });

    return {
      items,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    };
  }

  async createLicense(data, adminContext = {}) {
    const plan = data.plan || "pro";
    if (!PLAN_ENTITLEMENTS[plan]) {
      throw new AdminServiceError("INVALID_PLAN", `Invalid plan: ${plan}`, 400);
    }

    const maxDevices = Number(data.maxDevices) || 1;
    if (!Number.isInteger(maxDevices) || maxDevices < 1 || maxDevices > 10000) {
      throw new AdminServiceError("INVALID_MAX_DEVICES", "maxDevices must be an integer between 1 and 10000", 400);
    }

    const expiry = resolveLicenseExpiry(data);
    const { expiresAt } = expiry;

    if (!this.config.license.keyPepper || this.config.license.keyPepper.length < 16) {
      throw new AdminServiceError("SERVER_CONFIG_ERROR", "LICENSE_KEY_PEPPER is not configured", 500);
    }

    const rawKey = generateLicenseKey();
    const normalizedKey = rawKey.toUpperCase();
    const display = displayPartsForKey(normalizedKey);
    const keyHash = hashLicenseKey(normalizedKey, this.config.license.keyPepper);

    const licenseId = await this.licenseRepo.createLicense({
      keyHash,
      keyPrefix: display.prefix,
      keyLast4: display.last4,
      plan,
      maxDevices,
      expiresAt
    });

    await this.licenseRepo.insertEvent({
      licenseId,
      eventType: "license_created",
      ipAddress: adminContext.ip,
      metadata: {
        adminUserId: adminContext.adminId,
        plan,
        maxDevices,
        expiresInHours: expiry.expiresInHours,
        expiresInDays: expiry.expiresInDays,
        expiresAt: expiresAt ? expiresAt.toISOString() : null
      }
    });

    await this.adminRepo.insertAudit({
      adminUserId: adminContext.adminId,
      action: ADMIN_AUDIT_ACTIONS.LICENSE_CREATED,
      targetType: "license",
      targetId: String(licenseId),
      ipAddress: adminContext.ip,
      metadata: {
        plan,
        maxDevices,
        expiresInHours: expiry.expiresInHours,
        expiresInDays: expiry.expiresInDays,
        expiresAt: expiresAt ? expiresAt.toISOString() : null
      }
    });

    const entitlements = PLAN_ENTITLEMENTS[plan];

    return {
      license: {
        id: licenseId,
        displayKey: `${display.prefix}••••••••••••${display.last4}`,
        prefix: display.prefix,
        last4: display.last4,
        plan,
        status: LICENSE_STATUSES.ACTIVE,
        maxDevices,
        maxInstances: entitlements.maxInstances,
        features: entitlements.features,
        expiresAt: expiresAt ? expiresAt.toISOString() : null
      },
      licenseKey: rawKey
    };
  }

  async createDirectSaleLicense(data, adminContext = {}) {
    const plan = data.plan || "pro";
    const customerName = String(data.customerName || "Khách hàng cá nhân").trim();
    const customerContact = String(data.customerContact || "").trim();
    const salesChannel = String(data.salesChannel || "direct").trim();
    const customerNote = String(data.customerNote || "").trim();
    const domain = data.domain || "http://localhost:5173";
    const placeId = String(data.placeId || "107778070777162").trim();

    let maxDevices = Number(data.maxDevices) || 1;
    const expiry = resolveLicenseExpiry({
      ...data,
      expiresInDays: data.expiresInDays === 0 ? null : data.expiresInDays
    });
    const { expiresAt } = expiry;

    if (!this.config.license.keyPepper || this.config.license.keyPepper.length < 16) {
      throw new AdminServiceError("SERVER_CONFIG_ERROR", "LICENSE_KEY_PEPPER is not configured", 500);
    }

    const rawKey = generateLicenseKey();
    const normalizedKey = rawKey.toUpperCase();
    const display = displayPartsForKey(normalizedKey);
    const keyHash = hashLicenseKey(normalizedKey, this.config.license.keyPepper);

    const licenseId = await this.licenseRepo.createLicense({
      keyHash,
      keyPrefix: display.prefix,
      keyLast4: display.last4,
      plan,
      maxDevices,
      expiresAt,
      customerName,
      customerContact,
      salesChannel,
      customerNote
    });

    await this.licenseRepo.insertEvent({
      licenseId,
      eventType: "direct_sale_issued",
      ipAddress: adminContext.ip,
      metadata: {
        adminUserId: adminContext.adminId,
        customerName,
        customerContact,
        salesChannel,
        plan,
        maxDevices,
        placeId,
        expiresInHours: expiry.expiresInHours,
        expiresInDays: expiry.expiresInDays,
        expiresAt: expiresAt ? expiresAt.toISOString() : null
      }
    });

    await this.adminRepo.insertAudit({
      adminUserId: adminContext.adminId,
      action: "direct_license_sold",
      targetType: "license",
      targetId: String(licenseId),
      ipAddress: adminContext.ip,
      metadata: { customerName, salesChannel, plan, maxDevices, placeId, expiresInHours: expiry.expiresInHours, expiresInDays: expiry.expiresInDays }
    });

    const expiryText = formatExpiryText(expiry);

    const planName = data.planName || (plan === "business" ? "Trọn Đời (Lifetime)" : plan === "pro" ? "Gói Pro (Cao Cấp)" : "Gói Basic (Cơ Bản)");
    const allInOneCommand = buildAllInOneCommand({ domain, placeId, rawKey });

    const handoverText = 
`🎁 BÀN GIAO LICENSE KEY - AUTO REJOIN PRO
━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Khách hàng: ${customerName}
🔑 License Key: ${rawKey}
📦 Gói cước: ${planName}
📱 Giới hạn thiết bị: ${maxDevices} máy chạy cùng lúc
⏳ Thời hạn sử dụng: ${expiryText}
🎮 Place ID: ${placeId}
━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 CỔNG TỰ PHỤC VỤ & TRA CỨU / ĐỔI MÁY:
👉 ${domain}/portal
(Nhập mã Key để xem hạn dùng và tự bấm gỡ/đổi máy 24/7)

💻 LỆNH ALL-IN-ONE ANDROID / TERMUX:
${allInOneCommand}
━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 Cảm ơn bạn đã tin dùng Auto Rejoin Pro! Chúc bạn farm game hiệu quả.`;

    return {
      ok: true,
      licenseId,
      rawKey,
      customerName,
      salesChannel,
      plan,
      maxDevices,
      placeId,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      allInOneCommand,
      handoverTemplate: handoverText
    };
  }

  async getHandoverTemplate(licenseId, { domain = "http://localhost:5173" } = {}) {
    const license = await this.adminRepo.findLicenseById(licenseId);
    if (!license) {
      throw new AdminServiceError("LICENSE_NOT_FOUND", "License not found", 404);
    }

    const customerName = license.customer_name || "Khách hàng";
    const planName = license.plan === "business" ? "Trọn Đời (Lifetime)" : license.plan === "pro" ? "Gói Pro" : "Gói Basic";
    const expiryText = license.expires_at
      ? new Date(license.expires_at).toLocaleDateString("vi-VN")
      : "Vĩnh viễn (Trọn Đời)";
    const keyDisplay = `${license.license_key_prefix}••••••••••••${license.license_key_last4}`;

    const handoverText = 
`🎁 THÔNG TIN LICENSE KEY - AUTO REJOIN PRO
━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Khách hàng: ${customerName}
🔑 Mã License: ${keyDisplay}
📦 Gói cước: ${planName}
📱 Giới hạn thiết bị: ${license.max_devices} máy chạy cùng lúc
⏳ Hạn dùng: ${expiryText}
━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 CỔNG TỰ PHỤC VỤ & TRA CỨU / ĐỔI MÁY:
👉 ${domain}/portal
(Nhập mã Key để xem hạn dùng và tự bấm gỡ/đổi máy 24/7)

💬 Cần hỗ trợ: Liên hệ Admin trực tiếp để được trợ giúp 24/7!`;

    return {
      ok: true,
      licenseId: license.id,
      customerName,
      handoverTemplate: handoverText
    };
  }

  async getLicense(id) {
    const licenseId = Number(id);
    if (!Number.isInteger(licenseId) || licenseId <= 0) {
      throw new AdminServiceError("INVALID_ID", "Invalid license id", 400);
    }

    const lic = await this.adminRepo.findLicenseById(licenseId);
    if (!lic) {
      throw new AdminServiceError("LICENSE_NOT_FOUND", "License not found", 404);
    }

    const entitlements = PLAN_ENTITLEMENTS[lic.plan] || PLAN_ENTITLEMENTS.basic;

    return {
      id: lic.id,
      displayKey: `${lic.license_key_prefix}••••••••••••${lic.license_key_last4}`,
      prefix: lic.license_key_prefix,
      last4: lic.license_key_last4,
      plan: lic.plan,
      status: lic.status,
      maxDevices: Number(lic.max_devices),
      maxInstances: entitlements.maxInstances,
      features: entitlements.features,
      activeDeviceCount: Number(lic.active_devices_count || 0),
      expiresAt: lic.expires_at ? new Date(lic.expires_at).toISOString() : null,
      createdAt: new Date(lic.created_at).toISOString(),
      updatedAt: new Date(lic.updated_at).toISOString()
    };
  }

  async updateLicense(id, data, adminContext = {}) {
    const license = await this.getLicense(id);
    const updates = {};

    if (data.plan !== undefined) {
      if (!PLAN_ENTITLEMENTS[data.plan]) {
        throw new AdminServiceError("INVALID_PLAN", `Invalid plan: ${data.plan}`, 400);
      }
      updates.plan = data.plan;
    }

    if (data.maxDevices !== undefined) {
      const md = Number(data.maxDevices);
      if (!Number.isInteger(md) || md < 1 || md > 10000) {
        throw new AdminServiceError("INVALID_MAX_DEVICES", "maxDevices must be between 1 and 10000", 400);
      }
      updates.maxDevices = md;
    }

    if (data.expiresAt !== undefined) {
      if (data.expiresAt === null || data.expiresAt === "") {
        updates.expiresAt = null;
      } else {
        const date = new Date(data.expiresAt);
        if (Number.isNaN(date.getTime())) {
          throw new AdminServiceError("INVALID_EXPIRY", "Invalid expiresAt date format", 400);
        }
        updates.expiresAt = date;
      }
    }

    if (Object.keys(updates).length > 0) {
      await this.adminRepo.updateLicense(license.id, updates);

      await this.adminRepo.insertAudit({
        adminUserId: adminContext.adminId,
        action: ADMIN_AUDIT_ACTIONS.LICENSE_UPDATED,
        targetType: "license",
        targetId: String(license.id),
        ipAddress: adminContext.ip,
        metadata: updates
      });
    }

    return this.getLicense(license.id);
  }

  async extendLicense(id, days, adminContext = {}) {
    const license = await this.getLicense(id);
    const numDays = Number(days);
    if (!Number.isInteger(numDays) || numDays < 1 || numDays > 3650) {
      throw new AdminServiceError("INVALID_DAYS", "Days must be an integer between 1 and 3650", 400);
    }

    await this.adminRepo.extendLicense(license.id, numDays);

    await this.adminRepo.insertAudit({
      adminUserId: adminContext.adminId,
      action: ADMIN_AUDIT_ACTIONS.LICENSE_EXTENDED,
      targetType: "license",
      targetId: String(license.id),
      ipAddress: adminContext.ip,
      metadata: { days: numDays }
    });

    return this.getLicense(license.id);
  }

  async suspendLicense(id, adminContext = {}) {
    const license = await this.getLicense(id);
    if (license.status === LICENSE_STATUSES.REVOKED) {
      throw new AdminServiceError("REVOKED_LICENSE", "Cannot suspend a revoked license", 400);
    }

    await this.adminRepo.updateLicenseStatus(license.id, LICENSE_STATUSES.SUSPENDED);

    await this.adminRepo.insertAudit({
      adminUserId: adminContext.adminId,
      action: ADMIN_AUDIT_ACTIONS.LICENSE_SUSPENDED,
      targetType: "license",
      targetId: String(license.id),
      ipAddress: adminContext.ip
    });

    return this.getLicense(license.id);
  }

  async reactivateLicense(id, adminContext = {}) {
    const license = await this.getLicense(id);
    if (license.status === LICENSE_STATUSES.REVOKED) {
      throw new AdminServiceError("REVOKED_LICENSE", "Revoked licenses cannot be reactivated", 400);
    }

    await this.adminRepo.updateLicenseStatus(license.id, LICENSE_STATUSES.ACTIVE);

    await this.adminRepo.insertAudit({
      adminUserId: adminContext.adminId,
      action: ADMIN_AUDIT_ACTIONS.LICENSE_REACTIVATED,
      targetType: "license",
      targetId: String(license.id),
      ipAddress: adminContext.ip
    });

    return this.getLicense(license.id);
  }

  async revokeLicense(id, adminContext = {}) {
    const license = await this.getLicense(id);

    await this.adminRepo.updateLicenseStatus(license.id, LICENSE_STATUSES.REVOKED);
    await this.adminRepo.revokeAllTokensForLicense(license.id);

    await this.adminRepo.insertAudit({
      adminUserId: adminContext.adminId,
      action: ADMIN_AUDIT_ACTIONS.LICENSE_REVOKED,
      targetType: "license",
      targetId: String(license.id),
      ipAddress: adminContext.ip
    });

    return this.getLicense(license.id);
  }

  // ── Device Management ──────────────────────────────────────────────
  async listDevices(licenseId, query = {}) {
    await this.getLicense(licenseId);
    const result = await this.adminRepo.listDevicesForLicense(Number(licenseId), {
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 50
    });

    const items = result.items.map((d) => ({
      id: d.id,
      licenseId: d.license_id,
      installationId: d.installation_id,
      maskedInstallationId: maskInstallationId(d.installation_id),
      deviceName: d.device_name,
      platform: d.platform,
      executor: d.executor,
      clientVersion: d.client_version,
      status: d.revoked_at ? "revoked" : "active",
      firstActivatedAt: new Date(d.first_activated_at).toISOString(),
      lastSeenAt: new Date(d.last_seen_at).toISOString(),
      revokedAt: d.revoked_at ? new Date(d.revoked_at).toISOString() : null
    }));

    return {
      items,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    };
  }

  async revokeDevice(licenseId, deviceId, adminContext = {}) {
    await this.getLicense(licenseId);
    const device = await this.adminRepo.findDeviceById(Number(licenseId), Number(deviceId));
    if (!device) {
      throw new AdminServiceError("DEVICE_NOT_FOUND", "Device not found for this license", 404);
    }

    await this.adminRepo.revokeDeviceAndTokens(device.id);

    await this.adminRepo.insertAudit({
      adminUserId: adminContext.adminId,
      action: ADMIN_AUDIT_ACTIONS.DEVICE_REVOKED,
      targetType: "device",
      targetId: String(device.id),
      ipAddress: adminContext.ip,
      metadata: {
        licenseId: Number(licenseId),
        installationId: maskInstallationId(device.installation_id)
      }
    });

    return {
      ok: true,
      deviceId: device.id,
      status: "revoked"
    };
  }

  // ── Events & Audits ────────────────────────────────────────────────
  async listEvents(licenseId, query = {}) {
    await this.getLicense(licenseId);
    const result = await this.adminRepo.listEventsForLicense(Number(licenseId), {
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 20
    });

    const items = result.items.map((ev) => ({
      id: ev.id,
      licenseId: ev.license_id,
      deviceId: ev.device_id,
      eventType: ev.event_type,
      ipAddress: ev.ip_address,
      metadata: typeof ev.metadata_json === "string" ? JSON.parse(ev.metadata_json) : ev.metadata_json,
      device: ev.installation_id
        ? {
            maskedInstallationId: maskInstallationId(ev.installation_id),
            platform: ev.platform,
            executor: ev.executor
          }
        : null,
      createdAt: new Date(ev.created_at).toISOString()
    }));

    return {
      items,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    };
  }

  async listAuditLogs(query = {}) {
    const result = await this.adminRepo.listAudits({
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 20,
      action: query.action,
      targetType: query.targetType
    });

    const items = result.items.map((a) => ({
      id: a.id,
      adminUserId: a.admin_user_id,
      adminUsername: a.admin_username,
      action: a.action,
      targetType: a.target_type,
      targetId: a.target_id,
      ipAddress: a.ip_address,
      metadata: typeof a.metadata_json === "string" ? JSON.parse(a.metadata_json) : a.metadata_json,
      createdAt: new Date(a.created_at).toISOString()
    }));

    return {
      items,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    };
  }

  // ── Generic System Settings (API Keys, Marketing, SEO) ───────────────
  async getSystemSetting(key) {
    return await this.adminRepo.getSystemSetting(key);
  }

  async setSystemSetting(key, value, adminId, context = {}) {
    await this.adminRepo.setSystemSetting(key, value);
    if (adminId) {
      await this.adminRepo.insertAudit({
        adminUserId: adminId,
        action: "UPDATE_SYSTEM_SETTING",
        targetType: "setting",
        targetId: key,
        ipAddress: context.ip,
        metadata: { key }
      });
    }
    return true;
  }
}
