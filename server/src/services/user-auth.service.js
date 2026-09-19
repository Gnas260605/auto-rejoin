import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export class UserAuthService {
  constructor({ userRepository, walletRepository, rbacService, config }) {
    this.userRepo = userRepository;
    this.walletRepo = walletRepository;
    this.rbacService = rbacService;
    this.config = config || {};
    this.jwtSecret = this.config.customer?.jwtSecret || this.config.jwtSecret || this.config.admin?.jwtSecret || "default-customer-jwt-secret-key-32ch";
    this.accessTokenExpiresIn = "15m";
    this.refreshTokenExpiresDays = 30;
  }

  static hashToken(rawToken) {
    return crypto.createHash("sha256").update(rawToken).digest("hex");
  }

  async hashPassword(password) {
    if (!password || password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }
    return bcrypt.hash(password, 12);
  }

  async verifyPassword(password, hash) {
    if (!password || !hash) return false;
    return bcrypt.compare(password, hash);
  }

  generateAccessToken(user, permissions = []) {
    return jwt.sign(
      {
        sub: String(user.id),
        email: user.email,
        username: user.username,
        role: user.role,
        displayName: user.displayName,
        permissions,
        type: "customer_access"
      },
      this.jwtSecret,
      { expiresIn: this.accessTokenExpiresIn }
    );
  }

  verifyAccessToken(token) {
    return jwt.verify(token, this.jwtSecret);
  }

  async register({ email, username, phone = null, password, fullName, displayName }) {
    const cleanEmail = email.toLowerCase().trim();
    const cleanUsername = (username || email.split("@")[0]).toLowerCase().trim();
    const cleanDisplayName = (fullName || displayName || cleanUsername).trim();

    const existingEmail = await this.userRepo.findByEmail(cleanEmail);
    if (existingEmail) {
      const err = new Error("Email này đã được đăng ký");
      err.statusCode = 409;
      err.code = "EMAIL_EXISTS";
      throw err;
    }

    const existingUsername = await this.userRepo.findByUsername(cleanUsername);
    if (existingUsername) {
      const err = new Error("Tên đăng nhập này đã được sử dụng");
      err.statusCode = 409;
      err.code = "USERNAME_EXISTS";
      throw err;
    }

    const passwordHash = await this.hashPassword(password);
    const userId = await this.userRepo.createUser({
      email: cleanEmail,
      username: cleanUsername,
      phone,
      passwordHash,
      displayName: cleanDisplayName,
      role: "CUSTOMER",
      status: "ACTIVE"
    });

    let wallet = null;
    if (this.walletRepo) {
      await this.walletRepo.createWallet(userId);
      wallet = await this.walletRepo.findByUserId(userId);
    }

    const user = await this.userRepo.findById(userId);
    const permissions = this.rbacService ? await this.rbacService.getPermissionsForRole("CUSTOMER") : [];

    const rawRefreshToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = UserAuthService.hashToken(rawRefreshToken);
    const familyId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + this.refreshTokenExpiresDays * 24 * 60 * 60 * 1000);

    await this.userRepo.saveRefreshToken({
      userId: user.id,
      tokenHash,
      familyId,
      expiresAt
    });

    const accessToken = this.generateAccessToken(user, permissions);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        phone: user.phone,
        displayName: user.displayName,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt
      },
      wallet: wallet
        ? {
            id: wallet.id,
            balance: Number(wallet.balance),
            lockedBalance: Number(wallet.lockedBalance),
            currency: wallet.currency
          }
        : { balance: 0, lockedBalance: 0, currency: "VND" },
      accessToken,
      refreshToken: rawRefreshToken,
      permissions
    };
  }

  async login({ login: loginIdentifier, email, username, password, ip = null, userAgent = null }) {
    const ident = (loginIdentifier || email || username || "").trim();
    if (!ident) {
      const err = new Error("Vui lòng cung cấp tài khoản hoặc email");
      err.statusCode = 400;
      err.code = "INVALID_CREDENTIALS";
      throw err;
    }

    const user = await this.userRepo.findByLoginIdentifier(ident);
    if (!user) {
      const err = new Error("Tài khoản hoặc mật khẩu không chính xác");
      err.statusCode = 401;
      err.code = "INVALID_CREDENTIALS";
      throw err;
    }

    if (user.status === "BANNED") {
      const err = new Error("Tài khoản của bạn đã bị cấm truy cập");
      err.statusCode = 403;
      err.code = "ACCOUNT_BANNED";
      throw err;
    }

    if (user.status === "LOCKED") {
      const err = new Error("Tài khoản tạm thời bị khóa");
      err.statusCode = 403;
      err.code = "ACCOUNT_LOCKED";
      throw err;
    }

    const validPassword = await this.verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      const err = new Error("Tài khoản hoặc mật khẩu không chính xác");
      err.statusCode = 401;
      err.code = "INVALID_CREDENTIALS";
      throw err;
    }

    await this.userRepo.updateLastLogin(user.id);

    const permissions = this.rbacService ? await this.rbacService.getPermissionsForRole(user.role) : [];

    const rawRefreshToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = UserAuthService.hashToken(rawRefreshToken);
    const familyId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + this.refreshTokenExpiresDays * 24 * 60 * 60 * 1000);

    await this.userRepo.saveRefreshToken({
      userId: user.id,
      tokenHash,
      familyId,
      expiresAt,
      ip,
      userAgent
    });

    const accessToken = this.generateAccessToken(user, permissions);

    let wallet = null;
    if (this.walletRepo) {
      wallet = await this.walletRepo.findByUserId(user.id);
      if (!wallet) {
        await this.walletRepo.createWallet(user.id);
        wallet = await this.walletRepo.findByUserId(user.id);
      }
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        phone: user.phone,
        displayName: user.displayName,
        role: user.role,
        status: user.status,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt
      },
      wallet: wallet
        ? {
            id: wallet.id,
            balance: Number(wallet.balance),
            lockedBalance: Number(wallet.lockedBalance),
            currency: wallet.currency
          }
        : { balance: 0, lockedBalance: 0, currency: "VND" },
      accessToken,
      refreshToken: rawRefreshToken,
      permissions
    };
  }

  async refresh({ refreshToken, ip = null, userAgent = null }) {
    if (!refreshToken) {
      const err = new Error("Refresh token là bắt buộc");
      err.statusCode = 401;
      err.code = "MISSING_REFRESH_TOKEN";
      throw err;
    }

    const tokenHash = UserAuthService.hashToken(refreshToken);
    const storedToken = await this.userRepo.findRefreshToken(tokenHash);

    if (!storedToken) {
      const err = new Error("Refresh token không hợp lệ");
      err.statusCode = 401;
      err.code = "INVALID_REFRESH_TOKEN";
      throw err;
    }

    // Reuse detection
    if (storedToken.revokedAt) {
      await this.userRepo.revokeTokenFamily(storedToken.familyId);
      const err = new Error("Refresh token đã bị thu hồi hoặc sử dụng lại. Vui lòng đăng nhập lại.");
      err.statusCode = 401;
      err.code = "INVALID_REFRESH_TOKEN";
      throw err;
    }

    if (new Date(storedToken.expiresAt) < new Date()) {
      await this.userRepo.revokeRefreshToken(storedToken.id);
      const err = new Error("Refresh token đã hết hạn");
      err.statusCode = 401;
      err.code = "INVALID_REFRESH_TOKEN";
      throw err;
    }

    const user = await this.userRepo.findById(storedToken.userId);
    if (!user || user.status !== "ACTIVE") {
      await this.userRepo.revokeRefreshToken(storedToken.id);
      const err = new Error("Tài khoản không hoạt động");
      err.statusCode = 403;
      err.code = "USER_INACTIVE";
      throw err;
    }

    // Rotate
    await this.userRepo.revokeRefreshToken(storedToken.id);

    const newRawRefreshToken = crypto.randomBytes(32).toString("hex");
    const newTokenHash = UserAuthService.hashToken(newRawRefreshToken);
    const expiresAt = new Date(Date.now() + this.refreshTokenExpiresDays * 24 * 60 * 60 * 1000);

    await this.userRepo.saveRefreshToken({
      userId: user.id,
      tokenHash: newTokenHash,
      familyId: storedToken.familyId,
      expiresAt,
      ip,
      userAgent
    });

    const permissions = this.rbacService ? await this.rbacService.getPermissionsForRole(user.role) : [];
    const accessToken = this.generateAccessToken(user, permissions);

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        status: user.status
      },
      permissions
    };
  }

  async refreshTokens(params) {
    return this.refresh(params);
  }

  async logout(refreshToken) {
    if (refreshToken) {
      const tokenHash = UserAuthService.hashToken(refreshToken);
      const stored = await this.userRepo.findRefreshToken(tokenHash);
      if (stored) {
        await this.userRepo.revokeRefreshToken(stored.id);
      }
    }
  }

  async getMe(userId) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      const err = new Error("Người dùng không tồn tại");
      err.statusCode = 404;
      err.code = "USER_NOT_FOUND";
      throw err;
    }

    const permissions = this.rbacService ? await this.rbacService.getPermissionsForRole(user.role) : [];
    let wallet = null;
    if (this.walletRepo) {
      wallet = await this.walletRepo.findByUserId(user.id);
      if (!wallet) {
        await this.walletRepo.createWallet(user.id);
        wallet = await this.walletRepo.findByUserId(user.id);
      }
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      phone: user.phone,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      permissions,
      wallet: wallet
        ? {
            id: wallet.id,
            balance: Number(wallet.balance),
            lockedBalance: Number(wallet.lockedBalance),
            currency: wallet.currency
          }
        : null
    };
  }
}
