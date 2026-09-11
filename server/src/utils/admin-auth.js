import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const BCRYPT_ROUNDS = 10;

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
      role: admin.role
    },
    secret,
    {
      algorithm: "HS256",
      expiresIn: Math.floor(expiresInSeconds)
    }
  );
}

export function verifyAdminToken(token, secret) {
  try {
    return jwt.verify(token, secret, { algorithms: ["HS256"] });
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
