-- 011_create_user_wallet_rbac_tables.sql
-- Phase 1: Customer Auth, Roles, Permissions, Wallets, and Immutable Ledger

-- 1. Users table for Customers, Staff, and Admins
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(128) NOT NULL UNIQUE,
  username VARCHAR(64) NOT NULL UNIQUE,
  phone VARCHAR(32) NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(128) NOT NULL,
  role ENUM('CUSTOMER', 'STAFF', 'ADMIN', 'SUPER_ADMIN') NOT NULL DEFAULT 'CUSTOMER',
  status ENUM('ACTIVE', 'LOCKED', 'BANNED') NOT NULL DEFAULT 'ACTIVE',
  email_verified_at DATETIME NULL,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_users_email (email),
  INDEX idx_users_username (username),
  INDEX idx_users_phone (phone),
  INDEX idx_users_role (role),
  INDEX idx_users_status (status),
  INDEX idx_users_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Hashed Refresh Tokens table (Rotation & Token Family Tracking)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  family_id VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  created_ip VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_refresh_tokens_hash (token_hash),
  INDEX idx_refresh_tokens_user (user_id),
  INDEX idx_refresh_tokens_family (family_id),
  INDEX idx_refresh_tokens_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Dynamic RBAC: Roles table
CREATE TABLE IF NOT EXISTS roles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(32) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Dynamic RBAC: Permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Role-Permission mappings
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id BIGINT UNSIGNED NOT NULL,
  permission_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Wallets table (1-to-1 with user, strict non-negative balance, optimistic/pessimistic locking)
CREATE TABLE IF NOT EXISTS wallets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL UNIQUE,
  balance BIGINT NOT NULL DEFAULT 0,
  locked_balance BIGINT NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'VND',
  version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_wallets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_wallets_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Wallet Transactions (Immutable Ledger - strictly append-only)
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  wallet_id BIGINT UNSIGNED NOT NULL,
  type ENUM('TOPUP', 'PURCHASE', 'REFUND', 'ADJUSTMENT', 'REWARD') NOT NULL,
  direction ENUM('CREDIT', 'DEBIT') NOT NULL,
  amount BIGINT UNSIGNED NOT NULL,
  balance_before BIGINT NOT NULL,
  balance_after BIGINT NOT NULL,
  reference_type VARCHAR(64) NULL,
  reference_id VARCHAR(64) NULL,
  idempotency_key VARCHAR(128) NOT NULL UNIQUE,
  description VARCHAR(255) NOT NULL,
  actor_id BIGINT UNSIGNED NULL,
  metadata_json JSON NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_wallet_tx_wallet FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
  INDEX idx_wallet_tx_wallet_id (wallet_id),
  INDEX idx_wallet_tx_idempotency (idempotency_key),
  INDEX idx_wallet_tx_created_at (created_at),
  INDEX idx_wallet_tx_type (type),
  INDEX idx_wallet_tx_ref (reference_type, reference_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Seed Initial Roles
INSERT IGNORE INTO roles (id, name, description, created_at) VALUES
(1, 'CUSTOMER', 'Khách hàng mua sản phẩm, dịch vụ và mở túi mù', UTC_TIMESTAMP()),
(2, 'STAFF', 'Nhân viên xử lý ticket dịch vụ và đơn hàng', UTC_TIMESTAMP()),
(3, 'ADMIN', 'Quản trị viên quản lý danh mục, kho và nhân viên', UTC_TIMESTAMP()),
(4, 'SUPER_ADMIN', 'Quản trị cấp cao toàn quyền hệ thống', UTC_TIMESTAMP());

-- 9. Seed Granular Permissions
INSERT IGNORE INTO permissions (id, code, description, created_at) VALUES
(1, 'catalog.read', 'Xem danh mục và sản phẩm', UTC_TIMESTAMP()),
(2, 'catalog.write', 'Thêm sửa xóa danh mục và sản phẩm', UTC_TIMESTAMP()),
(3, 'inventory.read', 'Xem danh sách kho số', UTC_TIMESTAMP()),
(4, 'inventory.write', 'Nhập xuất và quản lý kho số', UTC_TIMESTAMP()),
(5, 'orders.read', 'Xem danh sách và chi tiết đơn hàng', UTC_TIMESTAMP()),
(6, 'orders.update', 'Cập nhật trạng thái đơn hàng', UTC_TIMESTAMP()),
(7, 'orders.refund', 'Hoàn tiền đơn hàng vào ví', UTC_TIMESTAMP()),
(8, 'tickets.read', 'Xem danh sách và chi tiết ticket dịch vụ', UTC_TIMESTAMP()),
(9, 'tickets.assign', 'Phân công ticket cho nhân viên', UTC_TIMESTAMP()),
(10, 'tickets.process', 'Xử lý, chat và hoàn thành ticket', UTC_TIMESTAMP()),
(11, 'payments.read', 'Xem lịch sử nạp thẻ và thanh toán', UTC_TIMESTAMP()),
(12, 'payments.reconcile', 'Đối soát và xử lý giao dịch nạp tiền', UTC_TIMESTAMP()),
(13, 'blindbox.configure', 'Cấu hình túi mù, phần thưởng và tỷ lệ', UTC_TIMESTAMP()),
(14, 'users.read', 'Xem danh sách người dùng và ví', UTC_TIMESTAMP()),
(15, 'users.update', 'Cập nhật thông tin người dùng', UTC_TIMESTAMP()),
(16, 'users.ban', 'Khóa hoặc cấm tài khoản người dùng', UTC_TIMESTAMP()),
(17, 'staff.manage', 'Quản lý nhân viên và phân quyền', UTC_TIMESTAMP()),
(18, 'settings.manage', 'Cấu hình hệ thống và cổng thanh toán', UTC_TIMESTAMP()),
(19, 'audit.read', 'Xem nhật ký kiểm toán hệ thống', UTC_TIMESTAMP()),
(20, 'wallet.read', 'Xem thông tin và lịch sử ví cá nhân', UTC_TIMESTAMP()),
(21, 'wallet.credit', 'Cộng tiền ví', UTC_TIMESTAMP()),
(22, 'wallet.debit', 'Trừ tiền ví thanh toán', UTC_TIMESTAMP());

-- 10. Seed Role Permissions
-- CUSTOMER (catalog.read, orders.read, tickets.read, wallet.read, wallet.debit)
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
(1, 1), (1, 5), (1, 8), (1, 20), (1, 22);

-- STAFF (catalog.read, inventory.read, orders.read, tickets.read, tickets.assign, tickets.process, users.read, wallet.read)
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
(2, 1), (2, 3), (2, 5), (2, 8), (2, 9), (2, 10), (2, 14), (2, 20);

-- ADMIN (all except staff.manage, settings.manage)
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
(3, 1), (3, 2), (3, 3), (3, 4), (3, 5), (3, 6), (3, 7), (3, 8), (3, 9), (3, 10),
(3, 11), (3, 12), (3, 13), (3, 14), (3, 15), (3, 16), (3, 19), (3, 20), (3, 21), (3, 22);

-- SUPER_ADMIN (all permissions 1..22)
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
(4, 1), (4, 2), (4, 3), (4, 4), (4, 5), (4, 6), (4, 7), (4, 8), (4, 9), (4, 10),
(4, 11), (4, 12), (4, 13), (4, 14), (4, 15), (4, 16), (4, 17), (4, 18), (4, 19), (4, 20), (4, 21), (4, 22);
