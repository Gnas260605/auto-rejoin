export const LICENSE_STATUSES = Object.freeze({
  ACTIVE: "active",
  REVOKED: "revoked",
  EXPIRED: "expired",
  SUSPENDED: "suspended"
});

export const LICENSE_ERROR_CODES = Object.freeze({
  INVALID_KEY: "INVALID_KEY",
  EXPIRED: "EXPIRED",
  REVOKED: "REVOKED",
  SUSPENDED: "SUSPENDED",
  DEVICE_LIMIT: "DEVICE_LIMIT",
  INVALID_TOKEN: "INVALID_TOKEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  INSTALLATION_MISMATCH: "INSTALLATION_MISMATCH",
  INVALID_REQUEST: "INVALID_REQUEST",
  SERVER_ERROR: "SERVER_ERROR"
});

export const PLAN_ENTITLEMENTS = Object.freeze({
  basic: {
    maxInstances: 1,
    features: ["monitor", "doctor"]
  },
  standard: {
    maxInstances: 5,
    features: ["monitor", "doctor", "discord", "profiles"]
  },
  pro: {
    maxInstances: 20,
    features: ["monitor", "doctor", "discord", "profiles", "installer"]
  },
  business: {
    maxInstances: 100,
    features: ["monitor", "doctor", "discord", "profiles", "installer"]
  }
});

export const LICENSE_KEY_PATTERN = /^AR-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
export const INSTALLATION_ID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
