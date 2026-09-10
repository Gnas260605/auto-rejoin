import rateLimit from "express-rate-limit";

function disabledLimit(_req, _res, next) {
  next();
}

export function createAdminRateLimits(config) {
  if (!config.rateLimit.enabled) {
    return {
      login: disabledLimit,
      api: disabledLimit
    };
  }

  const base = {
    windowMs: config.rateLimit.windowMs,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      ok: false,
      code: "RATE_LIMITED",
      message: "Too many requests, please try again later"
    }
  };

  return {
    login: rateLimit({
      ...base,
      max: config.rateLimit.adminLoginMax || 10,
      keyGenerator: (req) => {
        const username = typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : "";
        const ip = req.ip || req.socket?.remoteAddress || "unknown";
        return `${ip}_${username}`;
      }
    }),
    api: rateLimit({
      ...base,
      max: config.rateLimit.adminApiMax || 300
    })
  };
}
