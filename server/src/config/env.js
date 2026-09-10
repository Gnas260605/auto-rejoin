import dotenv from "dotenv";

dotenv.config();

function intEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

function boolEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

export function loadEnv() {
  const nodeEnv = process.env.NODE_ENV || "development";
  const jwtSecret = process.env.ADMIN_JWT_SECRET || (nodeEnv === "production" ? "" : "dev_insecure_admin_jwt_secret_32_chars_long!");
  if (nodeEnv === "production" && (!jwtSecret || jwtSecret.length < 16)) {
    throw new Error("ADMIN_JWT_SECRET must be at least 16 characters in production");
  }

  return {
    nodeEnv,
    port: intEnv("PORT", 3000),
    db: {
      host: process.env.DB_HOST || "127.0.0.1",
      port: intEnv("DB_PORT", 3306),
      user: process.env.DB_USER || "auto_rejoin",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "auto_rejoin_license"
    },
    license: {
      keyPepper: process.env.LICENSE_KEY_PEPPER || "",
      tokenTtlSeconds: intEnv("LICENSE_TOKEN_TTL_SECONDS", 2592000),
      revalidateAfterSeconds: intEnv("LICENSE_REVALIDATE_AFTER_SECONDS", 3600),
      minClientVersion: process.env.MIN_CLIENT_VERSION || "",
      maintenance: {
        enabled: boolEnv("LICENSE_MAINTENANCE_MODE", false),
        allowCachedEntitlements: boolEnv("LICENSE_MAINTENANCE_ALLOW_CACHE", true),
        message: process.env.LICENSE_MAINTENANCE_MESSAGE || "License service maintenance"
      }
    },
    admin: {
      jwtSecret,
      tokenTtlSeconds: intEnv("ADMIN_TOKEN_TTL_SECONDS", 86400),
      origins: (process.env.ADMIN_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      cookieSecure: boolEnv("COOKIE_SECURE", nodeEnv === "production"),
      cookieSameSite: process.env.COOKIE_SAMESITE || "lax"
    },
    rateLimit: {
      enabled: boolEnv("RATE_LIMIT_ENABLED", true),
      windowMs: intEnv("RATE_LIMIT_WINDOW_MS", 900000),
      activateMax: intEnv("RATE_LIMIT_ACTIVATE_MAX", 20),
      validateMax: intEnv("RATE_LIMIT_VALIDATE_MAX", 120),
      deactivateMax: intEnv("RATE_LIMIT_DEACTIVATE_MAX", 30),
      adminLoginMax: intEnv("RATE_LIMIT_ADMIN_LOGIN_MAX", 10),
      adminApiMax: intEnv("RATE_LIMIT_ADMIN_API_MAX", 300)
    }
  };
}

export const env = loadEnv();

