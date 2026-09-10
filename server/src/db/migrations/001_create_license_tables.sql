CREATE TABLE IF NOT EXISTS licenses (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  license_key_hash VARCHAR(255) NOT NULL UNIQUE,
  license_key_prefix VARCHAR(32) NOT NULL,
  license_key_last4 VARCHAR(8) NOT NULL,
  plan VARCHAR(32) NOT NULL,
  status ENUM('active','revoked','expired','suspended') NOT NULL DEFAULT 'active',
  max_devices INT UNSIGNED NOT NULL DEFAULT 1,
  expires_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_licenses_status (status),
  INDEX idx_licenses_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS license_devices (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  license_id BIGINT UNSIGNED NOT NULL,
  installation_id VARCHAR(64) NOT NULL,
  device_name VARCHAR(255) NULL,
  platform VARCHAR(64) NULL,
  executor VARCHAR(32) NULL,
  client_version VARCHAR(64) NULL,
  first_activated_at DATETIME NOT NULL,
  last_seen_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_license_installation (license_id, installation_id),
  INDEX idx_license_devices_license_id (license_id),
  INDEX idx_license_devices_installation_id (installation_id),
  INDEX idx_license_devices_revoked_at (revoked_at),
  CONSTRAINT fk_license_devices_license_id
    FOREIGN KEY (license_id) REFERENCES licenses(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS license_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  license_id BIGINT UNSIGNED NOT NULL,
  device_id BIGINT UNSIGNED NOT NULL,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  last_used_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  INDEX idx_license_tokens_license_id (license_id),
  INDEX idx_license_tokens_device_id (device_id),
  INDEX idx_license_tokens_expires_at (expires_at),
  INDEX idx_license_tokens_revoked_at (revoked_at),
  CONSTRAINT fk_license_tokens_license_id
    FOREIGN KEY (license_id) REFERENCES licenses(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_license_tokens_device_id
    FOREIGN KEY (device_id) REFERENCES license_devices(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS license_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  license_id BIGINT UNSIGNED NULL,
  device_id BIGINT UNSIGNED NULL,
  event_type VARCHAR(64) NOT NULL,
  ip_address VARCHAR(64) NULL,
  metadata_json JSON NULL,
  created_at DATETIME NOT NULL,
  INDEX idx_license_events_license_id (license_id),
  INDEX idx_license_events_device_id (device_id),
  INDEX idx_license_events_event_type (event_type),
  INDEX idx_license_events_created_at (created_at),
  CONSTRAINT fk_license_events_license_id
    FOREIGN KEY (license_id) REFERENCES licenses(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_license_events_device_id
    FOREIGN KEY (device_id) REFERENCES license_devices(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
