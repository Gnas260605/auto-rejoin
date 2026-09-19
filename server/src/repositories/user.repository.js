import crypto from "node:crypto";
import { toSqlDate } from "../utils/time.js";

export class UserRepository {
  constructor(pool = null) {
    this.pool = pool;
    this.users = [];
    this.refreshTokens = [];
    this.nextUserId = 1;
    this.nextTokenId = 1;
  }

  async findById(id) {
    if (!this.pool || typeof this.pool.query !== "function") {
      const u = this.users.find((user) => String(user.id) === String(id));
      return u ? { ...u } : null;
    }
    const [rows] = await this.pool.query(
      `SELECT id, email, username, phone, password_hash AS passwordHash, display_name AS displayName,
              role, status, email_verified_at AS emailVerifiedAt, last_login_at AS lastLoginAt,
              created_at AS createdAt, updated_at AS updatedAt
       FROM users
       WHERE id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  async findByEmail(email) {
    const cleanEmail = email.toLowerCase().trim();
    if (!this.pool || typeof this.pool.query !== "function") {
      const u = this.users.find((user) => user.email.toLowerCase() === cleanEmail);
      return u ? { ...u } : null;
    }
    const [rows] = await this.pool.query(
      `SELECT id, email, username, phone, password_hash AS passwordHash, display_name AS displayName,
              role, status, email_verified_at AS emailVerifiedAt, last_login_at AS lastLoginAt,
              created_at AS createdAt, updated_at AS updatedAt
       FROM users
       WHERE email = ?`,
      [cleanEmail]
    );
    return rows[0] || null;
  }

  async findByUsername(username) {
    const cleanUsername = username.toLowerCase().trim();
    if (!this.pool || typeof this.pool.query !== "function") {
      const u = this.users.find((user) => user.username.toLowerCase() === cleanUsername);
      return u ? { ...u } : null;
    }
    const [rows] = await this.pool.query(
      `SELECT id, email, username, phone, password_hash AS passwordHash, display_name AS displayName,
              role, status, email_verified_at AS emailVerifiedAt, last_login_at AS lastLoginAt,
              created_at AS createdAt, updated_at AS updatedAt
       FROM users
       WHERE LOWER(username) = ?`,
      [cleanUsername]
    );
    return rows[0] || null;
  }

  async findByLoginIdentifier(identifier) {
    const clean = identifier.trim().toLowerCase();
    if (clean.includes("@")) {
      return this.findByEmail(clean);
    }
    return this.findByUsername(clean);
  }

  async createUser({ email, username, phone = null, passwordHash, displayName, role = "CUSTOMER", status = "ACTIVE" }) {
    const now = toSqlDate();
    if (!this.pool || typeof this.pool.query !== "function") {
      const id = this.nextUserId++;
      const user = {
        id,
        email: email.toLowerCase().trim(),
        username: username.toLowerCase().trim(),
        phone: phone ? phone.trim() : null,
        passwordHash,
        displayName: displayName ? displayName.trim() : username,
        role,
        status,
        emailVerifiedAt: null,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now
      };
      this.users.push(user);
      return id;
    }
    const [result] = await this.pool.query(
      `INSERT INTO users (email, username, phone, password_hash, display_name, role, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        email.toLowerCase().trim(),
        username.toLowerCase().trim(),
        phone ? phone.trim() : null,
        passwordHash,
        displayName ? displayName.trim() : username,
        role,
        status,
        now,
        now
      ]
    );
    return result.insertId;
  }

  async updateLastLogin(id) {
    const now = toSqlDate();
    if (!this.pool || typeof this.pool.query !== "function") {
      const u = this.users.find((user) => String(user.id) === String(id));
      if (u) {
        u.lastLoginAt = now;
        u.updatedAt = now;
      }
      return;
    }
    await this.pool.query(
      `UPDATE users SET last_login_at = ? WHERE id = ?`,
      [now, id]
    );
  }

  async updateUser(id, fields = {}) {
    const now = toSqlDate();
    if (!this.pool || typeof this.pool.query !== "function") {
      const u = this.users.find((user) => String(user.id) === String(id));
      if (u) {
        Object.assign(u, fields, { updatedAt: now });
      }
      return;
    }
    const sets = [];
    const values = [];
    if (fields.displayName !== undefined) {
      sets.push("display_name = ?");
      values.push(fields.displayName);
    }
    if (fields.status !== undefined) {
      sets.push("status = ?");
      values.push(fields.status);
    }
    if (fields.passwordHash !== undefined) {
      sets.push("password_hash = ?");
      values.push(fields.passwordHash);
    }
    if (!sets.length) return;
    sets.push("updated_at = ?");
    values.push(now);
    values.push(id);
    await this.pool.query(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, values);
  }

  // Refresh Tokens management
  async saveRefreshToken({ userId, tokenHash, familyId, expiresAt, ip = null, userAgent = null }) {
    const now = toSqlDate();
    if (!this.pool || typeof this.pool.query !== "function") {
      const id = this.nextTokenId++;
      const rt = {
        id,
        userId: Number(userId),
        tokenHash,
        familyId,
        expiresAt: new Date(expiresAt).toISOString(),
        revokedAt: null,
        createdAt: now,
        createdIp: ip,
        userAgent
      };
      this.refreshTokens.push(rt);
      return id;
    }
    const [result] = await this.pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at, created_at, created_ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, tokenHash, familyId, toSqlDate(expiresAt), now, ip, userAgent ? userAgent.slice(0, 255) : null]
    );
    return result.insertId;
  }

  async findRefreshToken(tokenHash) {
    if (!this.pool || typeof this.pool.query !== "function") {
      const rt = this.refreshTokens.find((t) => t.tokenHash === tokenHash);
      return rt ? { ...rt } : null;
    }
    const [rows] = await this.pool.query(
      `SELECT id, user_id AS userId, token_hash AS tokenHash, family_id AS familyId,
              expires_at AS expiresAt, revoked_at AS revokedAt, created_at AS createdAt
       FROM refresh_tokens
       WHERE token_hash = ?`,
      [tokenHash]
    );
    return rows[0] || null;
  }

  async revokeRefreshToken(id) {
    const now = toSqlDate();
    if (!this.pool || typeof this.pool.query !== "function") {
      const rt = this.refreshTokens.find((t) => String(t.id) === String(id));
      if (rt) rt.revokedAt = now;
      return;
    }
    await this.pool.query(
      `UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?`,
      [now, id]
    );
  }

  async revokeTokenFamily(familyId) {
    const now = toSqlDate();
    if (!this.pool || typeof this.pool.query !== "function") {
      this.refreshTokens
        .filter((t) => t.familyId === familyId && !t.revokedAt)
        .forEach((t) => { t.revokedAt = now; });
      return;
    }
    await this.pool.query(
      `UPDATE refresh_tokens SET revoked_at = ? WHERE family_id = ? AND revoked_at IS NULL`,
      [now, familyId]
    );
  }
}
