CREATE TABLE IF NOT EXISTS system_settings (
  setting_key VARCHAR(64) PRIMARY KEY,
  setting_value JSON NOT NULL,
  updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO system_settings (setting_key, setting_value, updated_at) VALUES 
('pricing_plans', '[
  {
    "id": "day",
    "name": "1 Ngày",
    "badge": "Trial",
    "duration": "24 giờ",
    "priceFormatted": "10,000",
    "priceNumber": 10000,
    "plan": "basic",
    "maxDevices": 1,
    "enabled": true,
    "highlight": false,
    "description": "Dành cho nhu cầu test nhanh hoặc chạy farm ngắn hạn.",
    "features": [
      "1 Slot thiết bị",
      "Tự động quét server ít người",
      "Chống AFK 24/7",
      "Tự động rejoin khi crash",
      "Hỗ trợ Android / Termux"
    ]
  },
  {
    "id": "week",
    "name": "7 Ngày",
    "badge": "Weekly",
    "duration": "7 ngày",
    "priceFormatted": "40,000",
    "priceNumber": 40000,
    "plan": "standard",
    "maxDevices": 1,
    "enabled": true,
    "highlight": false,
    "description": "Phù hợp treo farm sự kiện hoặc cày nhiệm vụ tuần.",
    "features": [
      "1 Slot thiết bị",
      "Quét server ít người",
      "Anti-AFK & Auto Tap",
      "Tự phục hồi sau crash",
      "Đổi thiết bị không giới hạn",
      "Hỗ trợ kỹ thuật 24/7"
    ]
  },
  {
    "id": "month",
    "name": "30 Ngày",
    "badge": "Phổ biến",
    "duration": "30 ngày",
    "priceFormatted": "100,000",
    "priceNumber": 100000,
    "plan": "pro",
    "maxDevices": 2,
    "enabled": true,
    "highlight": true,
    "description": "Giải pháp tiêu chuẩn cho người cày game hàng ngày.",
    "features": [
      "2 Slot thiết bị cùng lúc",
      "Tối ưu cho nhiều tài khoản",
      "Chạy đa tab mượt mà",
      "Hỗ trợ đổi HWID / Reset máy tự động",
      "Ưu tiên hỗ trợ qua Discord",
      "Hỗ trợ kỹ thuật 24/7"
    ]
  },
  {
    "id": "lifetime",
    "name": "Trọn Đời",
    "badge": "Lifetime",
    "duration": "Vĩnh viễn",
    "priceFormatted": "250,000",
    "priceNumber": 250000,
    "plan": "business",
    "maxDevices": 4,
    "enabled": true,
    "highlight": false,
    "description": "Sử dụng lâu dài không cần gia hạn định kỳ.",
    "features": [
      "4 Slot thiết bị",
      "Full tính năng của tất cả gói",
      "Phân phối server tối ưu",
      "Tính năng Freeform đa cửa sổ",
      "Không bao giờ hết hạn",
      "Hỗ trợ 1 kèm 1 khi cần"
    ]
  }
]', UTC_TIMESTAMP());
