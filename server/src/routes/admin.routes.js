import express from "express";
import { z } from "zod";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required").max(100),
  password: z.string().min(1, "Password is required").max(255)
});

const batchCreateLicenseSchema = z.object({
  count: z.number().int().min(1).max(100).default(1),
  plan: z.string().min(1).max(32).default("pro"),
  maxDevices: z.number().int().min(1).max(10000).default(1),
  expiresInHours: z.number().int().min(1).max(87600).nullable().optional(),
  expiresInDays: z.number().int().min(1).max(3650).nullable().optional()
});

const createLicenseSchema = z.object({
  plan: z.string().min(1).max(32).default("pro"),
  maxDevices: z.number().int().min(1).max(10000).default(1),
  expiresInHours: z.number().int().min(1).max(87600).nullable().optional(),
  expiresInDays: z.number().int().min(1).max(3650).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional()
});

const directSaleLicenseSchema = z.object({
  customerName: z.string().max(128).optional(),
  customerContact: z.string().max(128).optional(),
  salesChannel: z.string().max(32).optional(),
  customerNote: z.string().max(500).optional(),
  plan: z.string().min(1).max(32).default("pro"),
  planName: z.string().max(128).optional(),
  placeId: z.string().regex(/^[0-9]{3,20}$/).optional(),
  maxDevices: z.number().int().min(1).max(10000).default(1),
  expiresInHours: z.number().int().min(1).max(87600).nullable().optional(),
  expiresInDays: z.number().int().min(0).max(3650).nullable().optional()
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

export function createAdminRouter({ controller, paymentController, authMiddleware, rateLimits }) {
  const router = express.Router();

  // Public / Login
  router.post("/auth/login", rateLimits.login, validateBody(loginSchema), controller.login);

  // Authenticated routes
  router.use(rateLimits.api);
  router.use(authMiddleware);

  router.post("/auth/logout", controller.logout);
  router.get("/auth/me", controller.getMe);

  // Meta & Stats & Pricing
  router.get("/meta/plans", controller.getPlans);
  router.get("/pricing", controller.getPricing);
  router.put("/pricing", controller.updatePricing);
  router.get("/stats", controller.getStats);

  // Payments & PayOS Management
  if (paymentController) {
    router.get("/payments", paymentController.listPayments);
    router.post("/payments/:paymentIdOrCode/verify", paymentController.manualVerify);
    router.post("/payments/:paymentCode/cancel", paymentController.cancelOrder);
    router.delete("/payments/:id", paymentController.deletePayment);
    router.post("/payments/cleanup-incomplete", paymentController.cleanupIncomplete);
    router.get("/payments/revenue-stats", paymentController.getRevenueStats);

    // PayOS Gateway Configuration & Testing
    router.get("/payos/config", paymentController.getPayOSConfig);
    router.put("/payos/config", paymentController.savePayOSConfig);
    router.post("/payos/test", paymentController.testPayOSConnection);
  }

  // Licenses
  router.get("/licenses", controller.listLicenses);
  router.post("/licenses", validateBody(createLicenseSchema), controller.createLicense);
  router.post("/licenses/direct-issue", validateBody(directSaleLicenseSchema), controller.createDirectSale);
  router.post("/licenses/batch", validateBody(batchCreateLicenseSchema), controller.batchCreateLicenses);
  router.get("/licenses/:id", controller.getLicense);
  router.get("/licenses/:id/handover", controller.getHandoverTemplate);
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

  // Generic Settings (API Keys, Marketing, SEO)
  router.get("/settings/:key", controller.getSetting);
  router.put("/settings/:key", controller.setSetting);

  return router;
}
