import { Router } from "express";

export function createPaymentRouter({ controller, rateLimits }) {
  const router = Router();

  // Public order creation & status polling
  router.post("/payments/create", rateLimits?.activate || ((_req, _res, next) => next()), controller.createOrder);
  router.get("/payments/:paymentCode/status", rateLimits?.validate || ((_req, _res, next) => next()), controller.getStatus);
  router.post("/payments/:paymentCode/cancel", controller.cancelOrder);

  // Webhooks for payment gateway / bank notification
  router.post("/payments/webhook", controller.handleWebhook);
  router.post("/payments/payos/webhook", controller.handlePayOSWebhook);

  return router;
}

