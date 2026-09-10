import express from "express";
import { z } from "zod";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required").max(100),
  password: z.string().min(1, "Password is required").max(255)
});

const createLicenseSchema = z.object({
  plan: z.string().min(1).max(32).default("pro"),
  maxDevices: z.number().int().min(1).max(10000).default(1),
  expiresInDays: z.number().int().min(1).max(3650).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional()
});

const updateLicenseSchema = z.object({
  plan: z.string().min(1).max(32).optional(),
  maxDevices: z.number().int().min(1).max(10000).optional(),
  expiresAt: z.string().datetime().nullable().optional()
});

const extendLicenseSchema = z.object({
  days: z.number().int().min(1).max(3650)
});

function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        ok: false,
        code: "INVALID_REQUEST",
        message: result.error.errors[0]?.message || "Invalid request payload",
        errors: result.error.errors
      });
    }
    req.body = result.data;
    next();
  };
}

export function createAdminRouter({ controller, authMiddleware, rateLimits }) {
  const router = express.Router();

  // Public / Login
  router.post("/auth/login", rateLimits.login, validateBody(loginSchema), controller.login);

  // Authenticated routes
  router.use(rateLimits.api);
  router.use(authMiddleware);

  router.post("/auth/logout", controller.logout);
  router.get("/auth/me", controller.getMe);

  // Meta & Stats
  router.get("/meta/plans", controller.getPlans);
  router.get("/stats", controller.getStats);

  // Licenses
  router.get("/licenses", controller.listLicenses);
  router.post("/licenses", validateBody(createLicenseSchema), controller.createLicense);
  router.get("/licenses/:id", controller.getLicense);
  router.patch("/licenses/:id", validateBody(updateLicenseSchema), controller.updateLicense);
  router.post("/licenses/:id/extend", validateBody(extendLicenseSchema), controller.extendLicense);
  router.post("/licenses/:id/suspend", controller.suspendLicense);
  router.post("/licenses/:id/reactivate", controller.reactivateLicense);
  router.post("/licenses/:id/revoke", controller.revokeLicense);

  // Devices under license
  router.get("/licenses/:id/devices", controller.listDevices);
  router.post("/licenses/:id/devices/:deviceId/revoke", controller.revokeDevice);

  // Events
  router.get("/licenses/:id/events", controller.listEvents);

  // Audit Logs
  router.get("/audit-logs", controller.listAuditLogs);

  return router;
}
