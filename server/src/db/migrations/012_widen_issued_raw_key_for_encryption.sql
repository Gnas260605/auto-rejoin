-- issued_raw_key giờ lưu dạng mã hoá "enc:v1:<iv>:<tag>:<ciphertext>" (~120 ký tự), VARCHAR(64) không đủ.
ALTER TABLE payments MODIFY issued_raw_key VARCHAR(255) NULL;
