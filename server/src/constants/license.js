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
    name: "Dùng Thử 4 Giờ",
    badge: "Test",
    duration: "4 giờ",
    durationHours: 4,
    priceFormatted: "0",
    priceNumber: 0,
    plan: "basic",
    maxDevices: 1,
    enabled: false,
    highlight: false,
    description: "Key dùng thử 4 giờ do quản trị viên cấp để trải nghiệm nhanh.",
    features: [
      "1 máy kích hoạt",
      "1 clone chạy cùng lúc",
      "Hiệu lực trong 4 giờ",
      "Tự động kết nối lại khi crash/kick",
      "Tự động vào server ít người"
    ]
  },
  {
    id: "day",
    name: "1 Ngày",
    badge: "Dùng Thử",
    duration: "24 giờ",
    priceFormatted: "10,000",
    priceNumber: 10000,
    plan: "basic",
    maxDevices: 1,
    enabled: true,
    highlight: false,
    description: "Dành cho nhu cầu trải nghiệm nhanh hoặc chạy ngắn hạn.",
    features: [
      "1 máy kích hoạt",
      "1 clone chạy cùng lúc",
      "Tự động vào server ít người",
      "Anti-AFK chống kick cơ bản",
      "Tự động kết nối lại khi crash/kick"
    ]
  },
  {
    id: "week",
    name: "7 Ngày",
    badge: "Theo Tuần",
    duration: "7 ngày",
    priceFormatted: "40,000",
    priceNumber: 40000,
    plan: "standard",
    maxDevices: 1,
    enabled: true,
    highlight: false,
    description: "Gói tiết kiệm tuần cho nhu cầu treo farm và cảnh báo cơ bản.",
    features: [
      "1 máy kích hoạt",
      "Tối đa 5 clone chạy cùng lúc",
      "Tự động vào server ít người",
      "Cảnh báo thông báo qua Discord",
      "Hỗ trợ lưu cấu hình theo profile"
    ]
  },
  {
    id: "month",
    name: "30 Ngày",
    badge: "Phổ biến",
    duration: "30 ngày",
    priceFormatted: "100,000",
    priceNumber: 100000,
    plan: "pro",
    maxDevices: 2,
    enabled: true,
    highlight: true,
    description: "Gói tiêu chuẩn cho nhiều tài khoản và thiết bị chạy song song.",
    features: [
      "2 máy kích hoạt cùng lúc",
      "Tối đa 20 clone chạy cùng lúc",
      "Tự động vào server ít người",
      "Cảnh báo Discord & Profile cấu hình",
      "Hỗ trợ bộ cài Roblox tự động"
    ]
  },
  {
    id: "lifetime",
    name: "Trọn Đời",
    badge: "Vĩnh Viễn",
    duration: "Vĩnh viễn",
    priceFormatted: "250,000",
    priceNumber: 250000,
    plan: "business",
    maxDevices: 4,
    enabled: true,
    highlight: false,
    description: "Mua một lần, sử dụng dài hạn và mở khóa toàn bộ tính năng cao cấp.",
    features: [
      "4 máy kích hoạt cùng lúc",
      "Tối đa 100 clone chạy cùng lúc",
      "Đầy đủ tính năng gói Pro",
      "Mở khóa đa cửa sổ Freeform",
      "Hỗ trợ kỹ thuật ưu tiên 1-1"
    ]
  }
]);

export const LICENSE_KEY_PATTERN = /^AR-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
export const INSTALLATION_ID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
