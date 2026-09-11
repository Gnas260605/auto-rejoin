import { ADMIN_COOKIE_NAME } from "../constants/admin.js";
import { AdminServiceError } from "../services/admin.service.js";

export class AdminController {
  constructor(adminService, config) {
    this.service = adminService;
    this.config = config;
  }

  setAuthCookie(res, token) {
    const cookieOptions = {
      httpOnly: true,
      secure: Boolean(this.config.admin.cookieSecure),
      sameSite: this.config.admin.cookieSameSite || "lax",
      maxAge: (this.config.admin.tokenTtlSeconds || 86400) * 1000,
      path: "/"
    };
    res.cookie(ADMIN_COOKIE_NAME, token, cookieOptions);
  }

  clearAuthCookie(res) {
    res.clearCookie(ADMIN_COOKIE_NAME, {
      httpOnly: true,
      secure: Boolean(this.config.admin.cookieSecure),
      sameSite: this.config.admin.cookieSameSite || "lax",
      path: "/"
    });
  }

  login = async (req, res, next) => {
    try {
      const result = await this.service.login(req.body, {
        ip: req.ip || req.socket?.remoteAddress
      });
      this.setAuthCookie(res, result.token);
      res.json({
        ok: true,
        admin: result.admin,
        token: result.token
      });
    } catch (error) {
      if (error instanceof AdminServiceError) {
        return res.status(error.httpStatus).json({
          ok: false,
          code: error.code,
          message: error.message
        });
      }
      next(error);
    }
  };

  logout = async (req, res, next) => {
    try {
      this.clearAuthCookie(res);
      await this.service.logout(req.admin?.id, {
        ip: req.ip || req.socket?.remoteAddress
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  };

  getMe = async (req, res, next) => {
    try {
      const admin = await this.service.getMe(req.admin.id);
      res.json({ ok: true, admin });
    } catch (error) {
      if (error instanceof AdminServiceError) {
        return res.status(error.httpStatus).json({
          ok: false,
          code: error.code,
          message: error.message
        });
      }
      next(error);
    }
  };

  getPlans = async (_req, res, next) => {
    try {
      const plans = this.service.getPlans();
      res.json({ ok: true, plans });
    } catch (error) {
      next(error);
    }
  };

  getPricing = async (_req, res, next) => {
    try {
      const plans = await this.service.getPricingSettings();
      res.json({ ok: true, plans });
    } catch (error) {
      next(error);
    }
  };

  updatePricing = async (req, res, next) => {
    try {
      const plans = await this.service.updatePricingSettings(req.body?.plans, {
        adminId: req.admin.id,
        ip: req.ip || req.socket?.remoteAddress
      });
      res.json({ ok: true, plans });
    } catch (error) {
      if (error instanceof AdminServiceError) {
        return res.status(error.httpStatus).json({
          ok: false,
          code: error.code,
          message: error.message
        });
      }
      next(error);
    }
  };

  getStats = async (_req, res, next) => {
    try {
      const stats = await this.service.getStats();
      res.json({ ok: true, stats });
    } catch (error) {
      next(error);
    }
  };

  listLicenses = async (req, res, next) => {
    try {
      const result = await this.service.listLicenses(req.query);
      res.json({ ok: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  createLicense = async (req, res, next) => {
    try {
      const result = await this.service.createLicense(req.body, {
        adminId: req.admin.id,
        ip: req.ip || req.socket?.remoteAddress
      });
      res.status(201).json({ ok: true, ...result });
    } catch (error) {
      if (error instanceof AdminServiceError) {
        return res.status(error.httpStatus).json({
          ok: false,
          code: error.code,
          message: error.message
        });
      }
      next(error);
    }
  };

  createDirectSale = async (req, res, next) => {
    try {
      const domain = `${req.protocol}://${req.get("host")}`;
      const result = await this.service.createDirectSaleLicense({
        ...req.body,
        domain
      }, {
        adminId: req.admin.id,
        ip: req.ip || req.socket?.remoteAddress
      });
      res.status(201).json({ ok: true, ...result });
    } catch (error) {
      if (error instanceof AdminServiceError) {
        return res.status(error.httpStatus).json({
          ok: false,
          code: error.code,
          message: error.message
        });
      }
      next(error);
    }
  };

  getHandoverTemplate = async (req, res, next) => {
    try {
      const domain = `${req.protocol}://${req.get("host")}`;
      const result = await this.service.getHandoverTemplate(req.params.id, { domain });
      res.json({ ok: true, ...result });
    } catch (error) {
      if (error instanceof AdminServiceError) {
        return res.status(error.httpStatus).json({
          ok: false,
          code: error.code,
          message: error.message
        });
      }
      next(error);
    }
  };

  batchCreateLicenses = async (req, res, next) => {
    try {
      const result = await this.service.batchCreateLicenses(req.body, {
        adminId: req.admin.id,
        ip: req.ip || req.socket?.remoteAddress
      });
      res.status(201).json({ ok: true, ...result });
    } catch (error) {
      if (error instanceof AdminServiceError) {
        return res.status(error.httpStatus).json({
          ok: false,
          code: error.code,
          message: error.message
        });
      }
      next(error);
    }
  };

  getLicense = async (req, res, next) => {
    try {
      const license = await this.service.getLicense(req.params.id);
      res.json({ ok: true, license });
    } catch (error) {
      if (error instanceof AdminServiceError) {
        return res.status(error.httpStatus).json({
          ok: false,
          code: error.code,
          message: error.message
        });
      }
      next(error);
    }
  };

  updateLicense = async (req, res, next) => {
    try {
      const license = await this.service.updateLicense(req.params.id, req.body, {
        adminId: req.admin.id,
        ip: req.ip || req.socket?.remoteAddress
      });
      res.json({ ok: true, license });
    } catch (error) {
      if (error instanceof AdminServiceError) {
        return res.status(error.httpStatus).json({
          ok: false,
          code: error.code,
          message: error.message
        });
      }
      next(error);
    }
  };

  extendLicense = async (req, res, next) => {
    try {
      const license = await this.service.extendLicense(req.params.id, req.body?.days, {
        adminId: req.admin.id,
        ip: req.ip || req.socket?.remoteAddress
      });
      res.json({ ok: true, license });
    } catch (error) {
      if (error instanceof AdminServiceError) {
        return res.status(error.httpStatus).json({
          ok: false,
          code: error.code,
          message: error.message
        });
      }
      next(error);
    }
  };

  suspendLicense = async (req, res, next) => {
    try {
      const license = await this.service.suspendLicense(req.params.id, {
        adminId: req.admin.id,
        ip: req.ip || req.socket?.remoteAddress
      });
      res.json({ ok: true, license });
    } catch (error) {
      if (error instanceof AdminServiceError) {
        return res.status(error.httpStatus).json({
          ok: false,
          code: error.code,
          message: error.message
        });
      }
      next(error);
    }
  };

  reactivateLicense = async (req, res, next) => {
    try {
      const license = await this.service.reactivateLicense(req.params.id, {
        adminId: req.admin.id,
        ip: req.ip || req.socket?.remoteAddress
      });
      res.json({ ok: true, license });
    } catch (error) {
      if (error instanceof AdminServiceError) {
        return res.status(error.httpStatus).json({
          ok: false,
          code: error.code,
          message: error.message
        });
      }
      next(error);
    }
  };

  revokeLicense = async (req, res, next) => {
    try {
      const license = await this.service.revokeLicense(req.params.id, {
        adminId: req.admin.id,
        ip: req.ip || req.socket?.remoteAddress
      });
      res.json({ ok: true, license });
    } catch (error) {
      if (error instanceof AdminServiceError) {
        return res.status(error.httpStatus).json({
          ok: false,
          code: error.code,
          message: error.message
        });
      }
      next(error);
    }
  };

  listDevices = async (req, res, next) => {
    try {
      const result = await this.service.listDevices(req.params.id, req.query);
      res.json({ ok: true, ...result });
    } catch (error) {
      if (error instanceof AdminServiceError) {
        return res.status(error.httpStatus).json({
          ok: false,
          code: error.code,
          message: error.message
        });
      }
      next(error);
    }
  };

  revokeDevice = async (req, res, next) => {
    try {
      const result = await this.service.revokeDevice(req.params.id, req.params.deviceId, {
        adminId: req.admin.id,
        ip: req.ip || req.socket?.remoteAddress
      });
      res.json({ ok: true, ...result });
    } catch (error) {
      if (error instanceof AdminServiceError) {
        return res.status(error.httpStatus).json({
          ok: false,
          code: error.code,
          message: error.message
        });
      }
      next(error);
    }
  };

  listEvents = async (req, res, next) => {
    try {
      const result = await this.service.listEvents(req.params.id, req.query);
      res.json({ ok: true, ...result });
    } catch (error) {
      if (error instanceof AdminServiceError) {
        return res.status(error.httpStatus).json({
          ok: false,
          code: error.code,
          message: error.message
        });
      }
      next(error);
    }
  };

  listAuditLogs = async (req, res, next) => {
    try {
      const result = await this.service.listAuditLogs(req.query);
      res.json({ ok: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  getSetting = async (req, res, next) => {
    try {
      const data = await this.service.getSystemSetting(req.params.key);
      res.json({ ok: true, data });
    } catch (error) {
      next(error);
    }
  };

  setSetting = async (req, res, next) => {
    try {
      await this.service.setSystemSetting(
        req.params.key,
        req.body,
        req.admin?.id,
        { ip: req.ip || req.socket?.remoteAddress }
      );
      res.json({ ok: true, message: "Setting updated successfully" });
    } catch (error) {
      next(error);
    }
  };
}
