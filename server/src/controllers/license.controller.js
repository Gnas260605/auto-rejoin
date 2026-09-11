import { z } from "zod";
import { LICENSE_KEY_PATTERN, INSTALLATION_ID_PATTERN } from "../constants/license.js";
import { errorResponse } from "../utils/response.js";

const deviceSchema = z.object({
  platform: z.string().trim().max(64).optional(),
  executor: z.string().trim().max(32).optional()
}).strict().optional();

const activateSchema = z.object({
  licenseKey: z.string().trim().max(64).regex(LICENSE_KEY_PATTERN),
  installationId: z.string().trim().max(64).regex(INSTALLATION_ID_PATTERN),
  clientVersion: z.string().trim().min(1).max(64),
  device: deviceSchema
}).strict();

const validateSchema = z.object({
  installationId: z.string().trim().max(64).regex(INSTALLATION_ID_PATTERN),
  clientVersion: z.string().trim().min(1).max(64).optional(),
  token: z.string().trim().min(16).max(256)
}).strict();

const deactivateSchema = z.object({
  installationId: z.string().trim().max(64).regex(INSTALLATION_ID_PATTERN),
  token: z.string().trim().min(16).max(256)
}).strict();

function parseBody(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    return null;
  }
  return result.data;
}

export class LicenseController {
  constructor(service) {
    this.service = service;
  }

  activate = async (req, res) => {
    const body = parseBody(activateSchema, req.body);
    if (!body) {
      res.status(400).json(errorResponse("INVALID_REQUEST", "Invalid activation request"));
      return;
    }
    const response = await this.service.activate(body, { ip: req.ip });
    res.status(response.valid ? 200 : this.statusForCode(response.code)).json(response);
  };

  validate = async (req, res) => {
    const body = parseBody(validateSchema, req.body);
    if (!body) {
      res.status(400).json(errorResponse("INVALID_REQUEST", "Invalid validation request"));
      return;
    }
    const response = await this.service.validate(body, { ip: req.ip });
    res.status(response.valid ? 200 : this.statusForCode(response.code)).json(response);
  };

  deactivate = async (req, res) => {
    const body = parseBody(deactivateSchema, req.body);
    if (!body) {
      res.status(400).json({ ...errorResponse("INVALID_REQUEST", "Invalid deactivation request"), deactivated: false });
      return;
    }
    const response = await this.service.deactivate(body, { ip: req.ip });
    res.status(response.valid ? 200 : this.statusForCode(response.code)).json(response);
  };

  lookup = async (req, res) => {
    try {
      const { licenseKey } = req.body || {};
      if (!licenseKey) {
        return res.status(400).json({ ok: false, message: "licenseKey is required" });
      }
      const data = await this.service.lookupLicense(licenseKey);
      res.json({ ok: true, data });
    } catch (error) {
      res.status(error.httpStatus || 400).json({ ok: false, code: error.code, message: error.message });
    }
  };

  customerResetDevice = async (req, res) => {
    try {
      const { licenseKey, deviceId } = req.body || {};
      if (!licenseKey || !deviceId) {
        return res.status(400).json({ ok: false, message: "licenseKey and deviceId are required" });
      }
      const result = await this.service.customerResetDevice(licenseKey, deviceId);
      res.json({ ok: true, ...result });
    } catch (error) {
      res.status(error.httpStatus || 400).json({ ok: false, code: error.code, message: error.message });
    }
  };

  createOrder = async (req, res) => {
    try {
      const result = await this.service.createCustomerOrder(req.body);
      res.status(201).json({ ok: true, ...result });
    } catch (error) {
      res.status(error.httpStatus || 400).json({ ok: false, message: error.message });
    }
  };

  getPublicPricing = async (_req, res) => {
    try {
      const plans = await this.service.getPublicPricing();
      res.json({ ok: true, plans });
    } catch (error) {
      res.status(500).json({ ok: false, message: error.message });
    }
  };

  statusForCode(code) {
    switch (code) {
      case "DEVICE_LIMIT":
      case "REVOKED":
      case "SUSPENDED":
      case "EXPIRED":
        return 403;
      case "INVALID_TOKEN":
      case "TOKEN_EXPIRED":
      case "INSTALLATION_MISMATCH":
      case "INVALID_KEY":
        return 401;
      case "INVALID_REQUEST":
        return 400;
      default:
        return 500;
    }
  }
}
