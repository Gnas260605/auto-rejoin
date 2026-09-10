import { Router } from "express";

export function createLicenseRouter({ controller, rateLimits }) {
  const router = Router();

  router.post("/licenses/activate", rateLimits.activate, controller.activate);
  router.post("/licenses/validate", rateLimits.validate, controller.validate);
  router.post("/licenses/deactivate", rateLimits.deactivate, controller.deactivate);

  return router;
}
