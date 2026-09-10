import rateLimit from "express-rate-limit";

function disabledLimit(_req, _res, next) {
  next();
}

export function createRateLimits(config) {
  if (!config.rateLimit.enabled) {
    return {
      activate: disabledLimit,
      validate: disabledLimit,
      deactivate: disabledLimit
    };
  }

  const base = {
    windowMs: config.rateLimit.windowMs,
    standardHeaders: true,
    legacyHeaders: false
  };

  return {
    activate: rateLimit({ ...base, max: config.rateLimit.activateMax }),
    validate: rateLimit({ ...base, max: config.rateLimit.validateMax }),
    deactivate: rateLimit({ ...base, max: config.rateLimit.deactivateMax })
  };
}
