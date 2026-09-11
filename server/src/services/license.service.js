import {
  INSTALLATION_ID_PATTERN,
  LICENSE_ERROR_CODES,
  LICENSE_KEY_PATTERN,
  LICENSE_STATUSES,
  DEFAULT_PRICING_PLANS,
  PLAN_ENTITLEMENTS
} from "../constants/license.js";
import { errorResponse, successResponse } from "../utils/response.js";
import { isExpired, secondsFromNow } from "../utils/time.js";
import {
  generateOpaqueToken,
  hashLicenseKey,
  hashToken,
  normalizeLicenseKey,
  generateLicenseKey,
  displayPartsForKey
} from "../utils/token.js";
import { sendDiscordWebhook, sendTelegramNotification } from "../utils/notification.js";

export class LicenseError extends Error {
  constructor(code, message, httpStatus = 400) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export class LicenseService {
  constructor({ repository, config, tokenUtils = {} }) {
    this.repository = repository;
    this.config = config;
    this.tokenUtils = {
      generateOpaqueToken,
      hashLicenseKey,
      hashToken,
      ...tokenUtils
    };
  }

  normalizeAndValidateKey(licenseKey) {
    const normalized = normalizeLicenseKey(licenseKey);
    if (!LICENSE_KEY_PATTERN.test(normalized)) {
      throw new LicenseError(LICENSE_ERROR_CODES.INVALID_REQUEST, "Invalid license key format", 400);
    }
    return normalized;
  }

  validateInstallationId(installationId) {
    if (!INSTALLATION_ID_PATTERN.test(String(installationId || ""))) {
      throw new LicenseError(LICENSE_ERROR_CODES.INVALID_REQUEST, "Invalid installation id", 400);
    }
  }

  entitlementsForPlan(plan) {
    return PLAN_ENTITLEMENTS[plan] || PLAN_ENTITLEMENTS.basic;
  }

  responseForLicense(license, token) {
    const entitlements = this.entitlementsForPlan(license.plan);
    const response = successResponse({
      licenseId: `lic_${license.id}`,
      plan: license.plan,
      expiresAt: license.expires_at ? new Date(license.expires_at).toISOString() : "",
      maxInstances: entitlements.maxInstances,
      features: entitlements.features,
      revalidateAfter: this.config.license.revalidateAfterSeconds,
      ...(token ? { token } : {})
    });
    if (this.config.license.maintenance?.enabled) {
      response.maintenance = {
        enabled: true,
        allowCachedEntitlements: Boolean(this.config.license.maintenance.allowCachedEntitlements),
        message: this.config.license.maintenance.message
      };
    }
    return response;
  }

  statusFailureForLicense(license) {
    if (!license) {
      return new LicenseError(LICENSE_ERROR_CODES.INVALID_KEY, "Invalid license key", 401);
    }
    if (license.status === LICENSE_STATUSES.REVOKED) {
      return new LicenseError(LICENSE_ERROR_CODES.REVOKED, "License is revoked", 403);
    }
    if (license.status === LICENSE_STATUSES.SUSPENDED) {
      return new LicenseError(LICENSE_ERROR_CODES.SUSPENDED, "License is suspended", 403);
    }
    if (license.status === LICENSE_STATUSES.EXPIRED || isExpired(license.expires_at)) {
      return new LicenseError(LICENSE_ERROR_CODES.EXPIRED, "License is expired", 403);
    }
    if (license.status !== LICENSE_STATUSES.ACTIVE) {
      return new LicenseError(LICENSE_ERROR_CODES.INVALID_KEY, "License is not active", 401);
    }
    return null;
  }

  async issueToken(repo, licenseId, deviceId) {
    const token = this.tokenUtils.generateOpaqueToken();
    const tokenHash = this.tokenUtils.hashToken(token);
    await repo.createToken({
      licenseId,
      deviceId,
      tokenHash,
      expiresAt: secondsFromNow(this.config.license.tokenTtlSeconds)
    });
    return token;
  }

  async activate(request, context = {}) {
    try {
      const normalizedKey = this.normalizeAndValidateKey(request.licenseKey);
      this.validateInstallationId(request.installationId);
      const keyHash = this.tokenUtils.hashLicenseKey(normalizedKey, this.config.license.keyPepper);

      return await this.repository.withTransaction(async (repo) => {
        const license = await repo.findLicenseByKeyHashForUpdate(keyHash);
        const statusFailure = this.statusFailureForLicense(license);
        if (statusFailure) {
          await repo.insertEvent({
            eventType: "activation_failed",
            ipAddress: context.ip,
            metadata: { code: statusFailure.code, keyPrefix: normalizedKey.slice(0, 8) }
          });
          throw statusFailure;
        }

        let device = await repo.findDeviceByInstallationId(license.id, request.installationId);
        if (!device || device.revoked_at) {
          const activeDevices = await repo.countActiveDevicesForLicense(license.id);
          if (activeDevices >= Number(license.max_devices)) {
            await repo.insertEvent({
              licenseId: license.id,
              eventType: "device_limit",
              ipAddress: context.ip,
              metadata: { installationId: request.installationId }
            });
            throw new LicenseError(LICENSE_ERROR_CODES.DEVICE_LIMIT, "Device limit reached", 403);
          }
          if (!device) {
            device = await repo.createDevice({
              licenseId: license.id,
              installationId: request.installationId,
              platform: request.device?.platform,
              executor: request.device?.executor,
              clientVersion: request.clientVersion
            });
          } else {
            await repo.updateDeviceSeen(device.id, {
              platform: request.device?.platform,
              executor: request.device?.executor,
              clientVersion: request.clientVersion
            });
            device.revoked_at = null;
          }
        } else {
          await repo.updateDeviceSeen(device.id, {
            platform: request.device?.platform,
            executor: request.device?.executor,
            clientVersion: request.clientVersion
          });
        }

        const token = await this.issueToken(repo, license.id, device.id);
        await repo.insertEvent({
          licenseId: license.id,
          deviceId: device.id,
          eventType: "activation_success",
          ipAddress: context.ip,
          metadata: { clientVersion: request.clientVersion }
        });
        return this.responseForLicense(license, token);
      });
    } catch (error) {
      if (error instanceof LicenseError) {
        return errorResponse(error.code, error.message);
      }
      throw error;
    }
  }

  async validate(request, context = {}) {
    this.validateInstallationId(request.installationId);
    if (!request.token || String(request.token).length > 256) {
      return errorResponse(LICENSE_ERROR_CODES.INVALID_TOKEN, "Invalid token");
    }
    const tokenHash = this.tokenUtils.hashToken(request.token);
    const bundle = await this.repository.findTokenBundleByHash(tokenHash);
    const failure = this.validationFailure(bundle, request.installationId);
    if (failure) {
      await this.repository.insertEvent({
        licenseId: bundle?.license_id,
        deviceId: bundle?.device_id,
        eventType: "validation_failed",
        ipAddress: context.ip,
        metadata: { code: failure.code, clientVersion: request.clientVersion }
      });
      return errorResponse(failure.code, failure.message);
    }

    await this.repository.touchTokenAndDevice(bundle.token_id, bundle.device_id);
    await this.repository.insertEvent({
      licenseId: bundle.license_id,
      deviceId: bundle.device_id,
      eventType: "validation_success",
      ipAddress: context.ip,
      metadata: { clientVersion: request.clientVersion }
    });
    return this.responseForLicense({
      id: bundle.license_id,
      plan: bundle.plan,
      expires_at: bundle.license_expires_at
    });
  }

  validationFailure(bundle, installationId) {
    if (!bundle) {
      return new LicenseError(LICENSE_ERROR_CODES.INVALID_TOKEN, "Invalid token", 401);
    }
    if (bundle.token_revoked_at || bundle.device_revoked_at) {
      return new LicenseError(LICENSE_ERROR_CODES.REVOKED, "License device or token is revoked", 403);
    }
    if (isExpired(bundle.token_expires_at)) {
      return new LicenseError(LICENSE_ERROR_CODES.TOKEN_EXPIRED, "Token is expired", 401);
    }
    if (bundle.installation_id !== installationId) {
      return new LicenseError(LICENSE_ERROR_CODES.INSTALLATION_MISMATCH, "Installation id does not match token", 401);
    }
    return this.statusFailureForLicense({
      id: bundle.license_id,
      status: bundle.status,
      expires_at: bundle.license_expires_at
    });
  }

  async deactivate(request, context = {}) {
    this.validateInstallationId(request.installationId);
    if (!request.token || String(request.token).length > 256) {
      return errorResponse(LICENSE_ERROR_CODES.INVALID_TOKEN, "Invalid token", { deactivated: false });
    }
    const tokenHash = this.tokenUtils.hashToken(request.token);
    const bundle = await this.repository.findTokenBundleByHash(tokenHash);
    const failure = this.validationFailure(bundle, request.installationId);
    if (failure) {
      await this.repository.insertEvent({
        licenseId: bundle?.license_id,
        deviceId: bundle?.device_id,
        eventType: "deactivation_failed",
        ipAddress: context.ip,
        metadata: { code: failure.code }
      });
      return { ...errorResponse(failure.code, failure.message), deactivated: false };
    }

    await this.repository.revokeDeviceAndTokens(bundle.device_id);
    await this.repository.insertEvent({
      licenseId: bundle.license_id,
      deviceId: bundle.device_id,
      eventType: "deactivation",
      ipAddress: context.ip
    });
    return {
      valid: true,
      deactivated: true,
      serverTime: successResponse().serverTime
    };
  }

  async lookupLicense(rawKey) {
    if (!rawKey || typeof rawKey !== "string") {
      throw new LicenseError(LICENSE_ERROR_CODES.INVALID_REQUEST, "License key is required", 400);
    }
    const normalizedKey = this.normalizeAndValidateKey(rawKey);
    const keyHash = this.tokenUtils.hashLicenseKey(normalizedKey, this.config.license.keyPepper);
    const license = await this.repository.findLicenseByKeyHash(keyHash);
    if (!license) {
      throw new LicenseError(LICENSE_ERROR_CODES.INVALID_KEY, "License key not found", 404);
    }

    const devices = await this.repository.listActiveDevicesForLicense(license.id);
    const entitlements = this.entitlementsForPlan(license.plan);
    const isLicenseExpired = license.expires_at ? isExpired(license.expires_at) : false;

    let computedStatus = license.status;
    if (license.status === "active" && isLicenseExpired) {
      computedStatus = "expired";
    }

    return {
      prefix: license.license_key_prefix,
      last4: license.license_key_last4,
      plan: license.plan,
      status: computedStatus,
      maxDevices: license.max_devices,
      activeDevicesCount: devices.length,
      expiresAt: license.expires_at ? new Date(license.expires_at).toISOString() : null,
      isExpired: isLicenseExpired,
      features: entitlements.features || [],
      maxInstances: entitlements.maxInstances || 1,
      devices: devices.map((d) => ({
        id: d.id,
        installationIdMasked: d.installation_id ? `${d.installation_id.slice(0, 4)}****${d.installation_id.slice(-4)}` : "Unknown",
        deviceName: d.device_name || "Unknown Device",
        platform: d.platform || "Android",
        lastSeenAt: d.last_seen_at ? new Date(d.last_seen_at).toISOString() : null,
        firstActivatedAt: d.first_activated_at ? new Date(d.first_activated_at).toISOString() : null
      }))
    };
  }

  async customerResetDevice(rawKey, deviceId) {
    if (!rawKey || !deviceId) {
      throw new LicenseError(LICENSE_ERROR_CODES.INVALID_REQUEST, "License key and deviceId are required", 400);
    }
    const normalizedKey = this.normalizeAndValidateKey(rawKey);
    const keyHash = this.tokenUtils.hashLicenseKey(normalizedKey, this.config.license.keyPepper);
    const license = await this.repository.findLicenseByKeyHash(keyHash);
    if (!license) {
      throw new LicenseError(LICENSE_ERROR_CODES.INVALID_KEY, "License key not found", 404);
    }

    const devices = await this.repository.listActiveDevicesForLicense(license.id);
    const target = devices.find((d) => d.id === Number(deviceId));
    if (!target) {
      throw new LicenseError(LICENSE_ERROR_CODES.INVALID_REQUEST, "Active device not found under this license", 404);
    }

    await this.repository.revokeDeviceAndTokens(target.id);
    await this.repository.insertEvent({
      licenseId: license.id,
      deviceId: target.id,
      eventType: "customer_device_reset",
      metadata: { deviceName: target.device_name }
    });

    return { success: true, message: "Device successfully unlinked" };
  }

  async createCustomerOrder(data) {
    const { plan = "month", price, orderCode, discordWebhook, telegramBotToken, telegramChatId } = data || {};

    // Look up dynamic plan configuration from database
    let matchedPlan = null;
    try {
      const dbPlans = await this.repository.getSystemSetting("pricing_plans");
      if (Array.isArray(dbPlans)) {
        matchedPlan = dbPlans.find((p) => p.id === plan) || null;
      }
    } catch (_e) {
      matchedPlan = null;
    }

    let expiresInDays = 30;
    if (matchedPlan) {
      const dur = String(matchedPlan.duration || "").toLowerCase();
      if (matchedPlan.id === "day" || dur.includes("24") || dur.includes("1 ngày")) {
        expiresInDays = 1;
      } else if (matchedPlan.id === "week" || dur.includes("7")) {
        expiresInDays = 7;
      } else if (matchedPlan.id === "month" || dur.includes("30")) {
        expiresInDays = 30;
      } else if (matchedPlan.id === "lifetime" || dur.includes("vĩnh viễn") || dur.includes("trọn đời")) {
        expiresInDays = null;
      } else {
        const num = dur.match(/\d+/);
        expiresInDays = num ? Number(num[0]) : 30;
      }
    } else {
      if (plan === "day") expiresInDays = 1;
      if (plan === "week") expiresInDays = 7;
      if (plan === "month") expiresInDays = 30;
      if (plan === "lifetime") expiresInDays = null;
    }

    const maxDevices = matchedPlan?.maxDevices ? Number(matchedPlan.maxDevices) : (plan === "lifetime" ? 4 : plan === "month" ? 2 : 1);
    const planName = matchedPlan?.plan || (plan === "lifetime" ? "business" : plan === "basic" ? "basic" : "pro");
    const finalPrice = price !== undefined && price !== null ? price : (matchedPlan?.priceNumber || 100000);
    const planDisplayName = matchedPlan?.name || plan.toUpperCase();

    const rawKey = generateLicenseKey();
    const normalizedKey = rawKey.toUpperCase();
    const display = displayPartsForKey(normalizedKey);
    const keyHash = hashLicenseKey(normalizedKey, this.config.license.keyPepper);

    const expiresAt = expiresInDays ? secondsFromNow(expiresInDays * 86400) : null;

    let licenseId = 0;
    try {
      licenseId = await this.repository.createLicense({
        keyHash,
        keyPrefix: display.prefix,
        keyLast4: display.last4,
        plan: planName,
        maxDevices,
        expiresAt
      });
    } catch (_e) {
      // if DB fails, continue with generated key
    }

    const notificationText = `🛒 <b>ĐƠN HÀNG MỚI - AUTO REJOIN PRO</b>\n` +
      `• Mã đơn: <code>${orderCode}</code>\n` +
      `• Gói mua: <b>${planDisplayName}</b> (${expiresInDays ? `${expiresInDays} ngày` : 'Vĩnh viễn'} - ${maxDevices} máy)\n` +
      `• Số tiền: <b>${Number(finalPrice).toLocaleString('vi-VN')} đ</b>\n` +
      `• License Key: <code>${rawKey}</code>\n` +
      `• Thời gian: ${new Date().toLocaleString('vi-VN')}`;

    if (telegramBotToken && telegramChatId) {
      sendTelegramNotification(telegramBotToken, telegramChatId, notificationText).catch(() => {});
    }

    if (discordWebhook) {
      sendDiscordWebhook(discordWebhook, {
        embeds: [{
          title: "🛒 ĐƠN HÀNG MỚI - AUTO REJOIN PRO",
          color: 0x10b981,
          fields: [
            { name: "Mã Đơn Hàng", value: orderCode || "N/A", inline: true },
            { name: "Gói Mua", value: plan.toUpperCase(), inline: true },
            { name: "Số Tiền", value: `${Number(price).toLocaleString('vi-VN')} đ`, inline: true },
            { name: "License Key Cấp Cho Khách", value: `\`${rawKey}\``, inline: false },
            { name: "Thời Hạn", value: expiresInDays ? `${expiresInDays} Ngày` : "Vĩnh Viễn", inline: true }
          ],
          footer: { text: "Hệ thống bán key tự động Auto Rejoin Pro" },
          timestamp: new Date().toISOString()
        }]
      }).catch(() => {});
    }

    return {
      success: true,
      orderCode,
      licenseKey: rawKey,
      plan: planName,
      maxDevices,
      expiresAt: expiresAt ? expiresAt.toISOString() : null
    };
  }

  async getPublicPricing() {
    const plans = await this.repository.getSystemSetting("pricing_plans");
    if (!plans || !Array.isArray(plans)) {
      return DEFAULT_PRICING_PLANS
        .filter((p) => p.enabled !== false)
        .map((plan) => ({ ...plan, features: [...plan.features] }));
    }
    return plans.filter((p) => p.enabled !== false);
  }
}
