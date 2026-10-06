import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getSecretKey(customKey) {
  const secret = customKey || process.env.INVENTORY_ENCRYPTION_KEY || process.env.LICENSE_KEY_PEPPER || "default_inventory_encryption_secret_key_32b!";
  return crypto.createHash("sha256").update(secret).digest();
}

// So sánh secret không lộ thời gian; băm trước để 2 chuỗi khác độ dài vẫn so được.
export function safeEqualSecret(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string" || !provided || !expected) {
    return false;
  }
  const a = crypto.createHash("sha256").update(provided).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

// Giá trị nhạy cảm cần đọc lại được (vd license key đã cấp) lưu dạng "enc:v1:<iv>:<tag>:<ciphertext>".
const SEALED_PREFIX = "enc:v1:";

export function isSealedValue(value) {
  return typeof value === "string" && value.startsWith(SEALED_PREFIX);
}

export function sealValue(plainText, key) {
  if (!plainText) return null;
  const { encryptedSecret, iv, authTag } = encryptSecret(String(plainText), key);
  return `${SEALED_PREFIX}${iv}:${authTag}:${encryptedSecret}`;
}

// Dữ liệu cũ chưa mã hoá được trả nguyên. Sai key/hỏng dữ liệu -> null (không ném lỗi ra API).
export function openSealedValue(value, key) {
  if (!value) return null;
  if (!isSealedValue(value)) return value;
  const [iv, authTag, cipherText] = value.slice(SEALED_PREFIX.length).split(":");
  try {
    return decryptSecret(cipherText, iv, authTag, key);
  } catch (_error) {
    return null;
  }
}

export function encryptSecret(plainText, customKey) {
  const iv = crypto.randomBytes(12);
  const key = getSecretKey(customKey);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return {
    encryptedSecret: encrypted,
    iv: iv.toString("hex"),
    authTag: authTag,
    secretLast4: plainText.length > 4 ? plainText.slice(-4) : plainText
  };
}

export function decryptSecret(encryptedSecret, ivHex, authTagHex, customKey) {
  const key = getSecretKey(customKey);
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedSecret, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
