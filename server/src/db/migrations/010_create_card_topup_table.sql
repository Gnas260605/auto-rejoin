-- 010_create_card_topup_table.sql
CREATE TABLE IF NOT EXISTS card_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  transaction_code VARCHAR(64) NOT NULL UNIQUE,
  telco ENUM('VIETTEL', 'VINAPHONE', 'MOBIFONE', 'ZING', 'GARENA') NOT NULL,
  declared_amount INT UNSIGNED NOT NULL,
  real_amount INT UNSIGNED NULL,
  serial VARCHAR(64) NOT NULL,
  pin VARCHAR(64) NOT NULL,
  status ENUM('PENDING', 'SUCCESS', 'FAILED', 'INVALID') NOT NULL DEFAULT 'PENDING',
  customer_contact VARCHAR(128) NULL,
  created_at DATETIME NOT NULL,
  processed_at DATETIME NULL,
  INDEX idx_card_tx_status (status),
  INDEX idx_card_tx_code (transaction_code),
  INDEX idx_card_tx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
