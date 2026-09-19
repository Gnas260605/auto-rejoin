import rateLimit from "express-rate-limit";

export function createCustomerRateLimits(config = {}) {
  const isProd = config.isProduction || process.env.NODE_ENV === "production";

  const registerLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: isProd ? 5 : 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      ok: false,
      code: "RATE_LIMIT_EXCEEDED",
      error: "Quá nhiều lượt đăng ký tài khoản từ IP này. Vui lòng thử lại sau 1 phút."
    }
  });

  const loginLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: isProd ? 10 : 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      ok: false,
      code: "RATE_LIMIT_EXCEEDED",
      error: "Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 1 phút."
    }
  });

  const refreshLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: isProd ? 30 : 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      ok: false,
      code: "RATE_LIMIT_EXCEEDED",
      error: "Quá nhiều yêu cầu làm mới phiên làm việc."
    }
  });

  const walletLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: isProd ? 60 : 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      ok: false,
      code: "RATE_LIMIT_EXCEEDED",
      error: "Quá nhiều yêu cầu ví tiền trong thời gian ngắn."
    }
  });

  return {
    registerLimiter,
    loginLimiter,
    refreshLimiter,
    walletLimiter
  };
}
