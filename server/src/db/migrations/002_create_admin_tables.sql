CREATE TABLE IF NOT EXISTS admin_users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','super_admin') NOT NULL DEFAULT 'admin',
  status ENUM('active','disabled') NOT NULL DEFAULT 'active',
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_admin_users_status (status),
  INDEX idx_admin_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_audit_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_user_id BIGINT UNSIGNED NULL,
  action VARCHAR(64) NOT NULL,
  target_type VARCHAR(64) NOT NULL,
  target_id VARCHAR(64) NULL,
  ip_address VARCHAR(64) NULL,
  metadata_json JSON NULL,
  created_at DATETIME NOT NULL,
  INDEX idx_admin_audit_admin_id (admin_user_id),
  INDEX idx_admin_audit_action (action),
  INDEX idx_admin_audit_target (target_type, target_id),
  INDEX idx_admin_audit_created_at (created_at),
  CONSTRAINT fk_admin_audit_admin_user
    FOREIGN KEY (admin_user_id) REFERENCES admin_users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
