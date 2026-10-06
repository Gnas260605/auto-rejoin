import { Router } from "express";
import { createWebhookAuthMiddleware } from "../middleware/webhook-auth.middleware.js";

export function createPaymentRouter({ controller, rateLimits, config = {} }) {
  const router = Router();
  const webhookAuth = createWebhookAuthMiddleware(config);

  // Public order creation & status polling
  router.post("/payments/create", rateLimits?.activate || ((_req, _res, next) => next()), controller.createOrder);
  router.get("/payments/:paymentCode/status", rateLimits?.validate || ((_req, _res, next) => next()), controller.getStatus);
  router.post("/payments/:paymentCode/cancel", controller.cancelOrder);

  // Webhooks for payment gateway / bank notification
  // Webhook ngân hàng (SePay/Casso) không có chữ ký -> bắt buộc secret chung. PayOS tự kiểm tra chữ ký HMAC.
  router.post("/payments/webhook", webhookAuth, controller.handleWebhook);
  router.post("/payments/payos/webhook", controller.handlePayOSWebhook);

  return router;
}

