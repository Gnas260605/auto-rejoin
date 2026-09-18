-- 009_create_commerce_tables.sql
-- Multi-product digital commerce platform tables

-- 1. Products Catalog
CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL,
  type ENUM('LICENSE', 'DIGITAL_KEY', 'DOWNLOAD', 'SERVICE', 'SUBSCRIPTION') NOT NULL DEFAULT 'LICENSE',
  status ENUM('ACTIVE', 'DRAFT', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  category VARCHAR(64) NOT NULL DEFAULT 'tools',
  short_description VARCHAR(255) NOT NULL,
  description TEXT NULL,
  thumbnail_url VARCHAR(255) NULL,
  badge VARCHAR(32) NULL,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_products_slug (slug),
  INDEX idx_products_type (type),
  INDEX idx_products_status (status),
  INDEX idx_products_is_public (is_public)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Product Variants (Different packages / pricing for each product)
CREATE TABLE IF NOT EXISTS product_variants (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  sku VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL,
  price INT UNSIGNED NOT NULL, -- in VND
  original_price INT UNSIGNED NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'VND',
  duration_days INT UNSIGNED NULL,
  max_devices INT UNSIGNED NULL DEFAULT 1,
  metadata_json JSON NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  stock_quantity INT NOT NULL DEFAULT -1, -- -1 means dynamic unlimited
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_variants_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_variants_product_id (product_id),
  INDEX idx_variants_sku (sku),
  INDEX idx_variants_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Digital Inventory Items (Encrypted serial keys for 3rd-party products / accounts / gift codes)
CREATE TABLE IF NOT EXISTS digital_inventory_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  variant_id BIGINT UNSIGNED NULL,
  encrypted_secret TEXT NOT NULL, -- AES-256-GCM encrypted
  iv VARCHAR(64) NOT NULL,
  auth_tag VARCHAR(64) NOT NULL,
  secret_last4 VARCHAR(16) NOT NULL,
  status ENUM('AVAILABLE', 'RESERVED', 'SOLD', 'REVOKED') NOT NULL DEFAULT 'AVAILABLE',
  order_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  sold_at DATETIME NULL,
  CONSTRAINT fk_inventory_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_inventory_product_id (product_id),
  INDEX idx_inventory_variant_id (variant_id),
  INDEX idx_inventory_status (status),
  INDEX idx_inventory_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Commerce Orders
CREATE TABLE IF NOT EXISTS commerce_orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_code VARCHAR(64) NOT NULL UNIQUE,
  customer_email VARCHAR(128) NULL,
  customer_name VARCHAR(128) NULL,
  customer_phone VARCHAR(32) NULL,
  status ENUM('pending', 'paid', 'fulfilling', 'fulfilled', 'failed', 'cancelled', 'expired') NOT NULL DEFAULT 'pending',
  currency VARCHAR(10) NOT NULL DEFAULT 'VND',
  total_amount INT UNSIGNED NOT NULL,
  payment_method VARCHAR(32) NOT NULL DEFAULT 'vietqr',
  payment_code VARCHAR(64) NULL,
  transfer_content VARCHAR(128) NULL,
  metadata_json JSON NULL,
  created_at DATETIME NOT NULL,
  paid_at DATETIME NULL,
  fulfilled_at DATETIME NULL,
  expired_at DATETIME NOT NULL,
  INDEX idx_orders_code (order_code),
  INDEX idx_orders_status (status),
  INDEX idx_orders_email (customer_email),
  INDEX idx_orders_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Order Items
CREATE TABLE IF NOT EXISTS commerce_order_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  variant_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  unit_price INT UNSIGNED NOT NULL,
  total_price INT UNSIGNED NOT NULL,
  fulfillment_type ENUM('LICENSE', 'DIGITAL_KEY', 'DOWNLOAD', 'SERVICE', 'SUBSCRIPTION') NOT NULL,
  fulfillment_data_json JSON NULL,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES commerce_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_order_items_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id),
  INDEX idx_order_items_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Fulfillments History (Audit & Delivery Records)
CREATE TABLE IF NOT EXISTS fulfillments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NOT NULL,
  fulfillment_type ENUM('LICENSE', 'DIGITAL_KEY', 'DOWNLOAD', 'SERVICE', 'SUBSCRIPTION') NOT NULL,
  status ENUM('PENDING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'PENDING',
  delivered_payload_json JSON NULL,
  error_message TEXT NULL,
  created_at DATETIME NOT NULL,
  completed_at DATETIME NULL,
  CONSTRAINT fk_fulfillments_order FOREIGN KEY (order_id) REFERENCES commerce_orders(id) ON DELETE CASCADE,
  INDEX idx_fulfillments_order_id (order_id),
  INDEX idx_fulfillments_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
