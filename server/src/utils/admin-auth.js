import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const BCRYPT_ROUNDS = 10;
export const ADMIN_TOKEN_TYPE = "admin_access";

export async function hashPassword(password) {
  if (typeof password !== "string" || password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(password, hash) {
  if (typeof password !== "string" || typeof hash !== "string") {
    return false;
  }
  return bcrypt.compare(password, hash);
}

export function signAdminToken(admin, secret, expiresInSeconds = 86400) {
  return jwt.sign(
    {
      sub: String(admin.id),
      username: admin.username,
      role: admin.role,
      type: ADMIN_TOKEN_TYPE
    },
    secret,
    {
      algorithm: "HS256",
      expiresIn: Math.floor(expiresInSeconds)
    }
  );
}

// Bắt buộc đúng loại token: nếu secret admin và khách hàng trùng nhau, token khách hàng
// (sub = id khách hàng) vẫn không được dùng như token admin.
export function verifyAdminToken(token, secret) {
  try {
    const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
    return payload?.type === ADMIN_TOKEN_TYPE ? payload : null;
  } catch (_error) {
    return null;
  }
}

export function maskInstallationId(installationId) {
  if (!installationId || typeof installationId !== "string") {
    return "";
  }
  const clean = installationId.trim();
  if (clean.length <= 8) {
    return clean;
  }
  return `${clean.slice(0, 4)}****${clean.slice(-4)}`;
}
