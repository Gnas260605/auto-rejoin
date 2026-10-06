import { safeEqualSecret } from "../utils/crypto.js";

// Secret chung với cổng thanh toán. Hỗ trợ cách gửi của SePay (`Authorization: Apikey <secret>`),
// Casso (`secure-token: <secret>`), Bearer và header riêng `x-webhook-secret`.
function extractWebhookSecret(req) {
  const authorization = req.get("authorization") || "";
  const match = authorization.match(/^(?:apikey|bearer)\s+(.+)$/i);
  if (match) {
    return match[1].trim();
  }
  return (req.get("secure-token") || req.get("x-webhook-secret") || "").trim();
}

export function createWebhookAuthMiddleware(config) {
  const secret = config.payment?.webhookSecret || "";

  return function webhookAuthMiddleware(req, res, next) {
    if (!secret) {
      // Không có secret = ai cũng giả được giao dịch -> tắt hẳn ở production.
      if (config.nodeEnv === "production") {
        return res.status(503).json({
          ok: false,
          code: "WEBHOOK_DISABLED",
          message: "PAYMENT_WEBHOOK_SECRET is not configured"
        });
      }
      return next();
    }

    if (!safeEqualSecret(extractWebhookSecret(req), secret)) {
      return res.status(401).json({
        ok: false,
        code: "INVALID_WEBHOOK_SECRET",
        message: "Invalid or missing webhook secret"
      });
    }
    next();
  };
}
