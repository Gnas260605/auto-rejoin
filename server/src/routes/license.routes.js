import { Router } from "express";

export function createLicenseRouter({ controller, rateLimits }) {
  const router = Router();

  router.get("/meta/public-pricing", controller.getPublicPricing);
  router.post("/licenses/activate", rateLimits.activate, controller.activate);
  router.post("/licenses/validate", rateLimits.validate, controller.validate);
  router.post("/licenses/deactivate", rateLimits.deactivate, controller.deactivate);
  router.post("/licenses/lookup", rateLimits.validate, controller.lookup);
  router.post("/licenses/customer-reset-device", rateLimits.deactivate, controller.customerResetDevice);
  router.post("/licenses/order", rateLimits.activate, controller.createOrder);

  return router;
}
