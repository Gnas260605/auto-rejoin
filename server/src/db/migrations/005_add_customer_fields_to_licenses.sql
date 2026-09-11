ALTER TABLE licenses
  ADD COLUMN customer_name VARCHAR(128) NULL,
  ADD COLUMN customer_contact VARCHAR(128) NULL,
  ADD COLUMN sales_channel VARCHAR(32) NULL DEFAULT 'direct',
  ADD COLUMN customer_note TEXT NULL;
