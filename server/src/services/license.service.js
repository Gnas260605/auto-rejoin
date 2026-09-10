import {
  INSTALLATION_ID_PATTERN,
  LICENSE_ERROR_CODES,
  LICENSE_KEY_PATTERN,
  LICENSE_STATUSES,
  PLAN_ENTITLEMENTS
} from "../constants/license.js";
import { errorResponse, successResponse } from "../utils/response.js";
import { isExpired, secondsFromNow } from "../utils/time.js";
import {
  generateOpaqueToken,
  hashLicenseKey,
  hashToken,
  normalizeLicenseKey
} from "../utils/token.js";

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
}
