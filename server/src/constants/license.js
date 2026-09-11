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
    features: ["monitor", "doctor", "low_server", "anti_afk"]
  },
  standard: {
    maxInstances: 5,
    features: ["monitor", "doctor", "low_server", "anti_afk", "discord", "profiles"]
  },
  pro: {
    maxInstances: 20,
    features: ["monitor", "doctor", "low_server", "anti_afk", "discord", "profiles", "installer"]
  },
  business: {
    maxInstances: 100,
    features: ["monitor", "doctor", "low_server", "anti_afk", "discord", "profiles", "installer", "freeform", "priority_support"]
  }
});

export const DEFAULT_PRICING_PLANS = Object.freeze([
  {
    id: "trial_4h",
    name: "Trial 4 Gio",
    badge: "Test",
    duration: "4 gio",
    durationHours: 4,
    priceFormatted: "0",
    priceNumber: 0,
    plan: "basic",
    maxDevices: 1,
    enabled: false,
    highlight: false,
    description: "Key dung thu 4 gio do admin cap de khach test nhanh.",
    features: [
      "1 may active",
      "1 clone chay cung luc",
      "Hieu luc 4 gio",
      "Auto rejoin khi crash/kick",
      "Auto join server it nguoi"
    ]
  },
  {
    id: "day",
    name: "1 Ngay",
    badge: "Trial",
    duration: "24 gio",
    priceFormatted: "10,000",
    priceNumber: 10000,
    plan: "basic",
    maxDevices: 1,
    enabled: true,
    highlight: false,
    description: "Danh cho nhu cau test nhanh hoac chay ngan han.",
    features: [
      "1 may active",
      "1 clone chay cung luc",
      "Auto join server it nguoi",
      "Anti-AFK co ban",
      "Auto rejoin khi crash/kick"
    ]
  },
  {
    id: "week",
    name: "7 Ngay",
    badge: "Weekly",
    duration: "7 ngay",
    priceFormatted: "40,000",
    priceNumber: 40000,
    plan: "standard",
    maxDevices: 1,
    enabled: true,
    highlight: false,
    description: "Goi tiet kiem tuan cho treo farm va canh bao co ban.",
    features: [
      "1 may active",
      "Toi da 5 clone",
      "Auto join server it nguoi",
      "Canh bao Discord",
      "Ho tro profile cau hinh"
    ]
  },
  {
    id: "month",
    name: "30 Ngay",
    badge: "Pho bien",
    duration: "30 ngay",
    priceFormatted: "100,000",
    priceNumber: 100000,
    plan: "pro",
    maxDevices: 2,
    enabled: true,
    highlight: true,
    description: "Goi tieu chuan cho nhieu tai khoan va thiet bi chay song song.",
    features: [
      "2 may active cung luc",
      "Toi da 20 clone",
      "Auto join server it nguoi",
      "Canh bao Discord va profile",
      "Ho tro installer Roblox"
    ]
  },
  {
    id: "lifetime",
    name: "Tron Doi",
    badge: "Lifetime",
    duration: "Vinh vien",
    priceFormatted: "250,000",
    priceNumber: 250000,
    plan: "business",
    maxDevices: 4,
    enabled: true,
    highlight: false,
    description: "Mua mot lan, dung dai han va mo khoa tinh nang nang cao.",
    features: [
      "4 may active cung luc",
      "Toi da 100 clone",
      "Full tinh nang goi Pro",
      "Freeform da cua so",
      "Ho tro uu tien 1-1"
    ]
  }
]);

export const LICENSE_KEY_PATTERN = /^AR-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
export const INSTALLATION_ID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
