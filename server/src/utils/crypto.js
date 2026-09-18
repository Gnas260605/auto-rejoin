import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getSecretKey(customKey) {
  const secret = customKey || process.env.INVENTORY_ENCRYPTION_KEY || process.env.LICENSE_KEY_PEPPER || "default_inventory_encryption_secret_key_32b!";
  return crypto.createHash("sha256").update(secret).digest();
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
