import crypto from "node:crypto";

export function normalizeLicenseKey(key) {
  return String(key || "").trim().toUpperCase();
}

export function hashLicenseKey(normalizedKey, pepper) {
  if (!pepper) {
    throw new Error("LICENSE_KEY_PEPPER is required");
  }
  return crypto.createHmac("sha256", pepper).update(normalizedKey).digest("hex");
}

export function generateOpaqueToken(byteLength = 48) {
  return crypto.randomBytes(byteLength).toString("base64url");
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

export function generateLicenseKey() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(16);
  let out = "";
  for (const byte of bytes) {
    out += alphabet[byte % alphabet.length];
  }
  return `AR-${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}-${out.slice(12, 16)}`;
}

export function displayPartsForKey(normalizedKey) {
  return {
    prefix: normalizedKey.slice(0, 8),
    last4: normalizedKey.slice(-4)
  };
}
