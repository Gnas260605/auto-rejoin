import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { createApp } from "../src/app.js";
import { UserRepository } from "../src/repositories/user.repository.js";
import { WalletRepository } from "../src/repositories/wallet.repository.js";
import { RbacRepository } from "../src/repositories/rbac.repository.js";
import { RbacService } from "../src/services/rbac.service.js";
import { UserAuthService } from "../src/services/user-auth.service.js";

const TEST_SECRET = "customer_jwt_secret_must_be_at_least_32_bytes_long!!";

const baseConfig = {
  nodeEnv: "test",
  license: {
    keyPepper: "test_pepper_12345678901234567890",
    tokenTtlSeconds: 86400,
    revalidateAfterSeconds: 3600,
    minClientVersion: "",
    maintenance: { enabled: false }
  },
  admin: {
    jwtSecret: "admin_test_secret_32_chars_long!!",
    tokenTtlSeconds: 3600,
    origins: ["*"],
    cookieSecure: false,
    cookieSameSite: "lax"
  },
  customer: {
    jwtSecret: TEST_SECRET,
    tokenTtlSeconds: 900,
    refreshTokenTtlSeconds: 604800,
    cookieSecure: false,
    cookieSameSite: "lax"
  },
  rateLimit: {
    enabled: false
  }
};

class MockLicenseRepository {
  async listLicenses() {
    return { items: [], total: 0, page: 1, limit: 20, totalPages: 1 };
  }
}

class MockAdminRepository {
  async findAdminByUsername() { return null; }
  async findAdminById() { return null; }
}

class MockCommerceRepository {
  async listProducts() { return []; }
}

class MockPaymentRepository {
  async listPayments() { return []; }
}

test("UserAuthService: password hashing and verification", async () => {
  const userRepo = new UserRepository(null);
  const walletRepo = new WalletRepository(null);
  const rbacService = new RbacService({ rbacRepository: new RbacRepository(null) });
  const authService = new UserAuthService({ userRepository: userRepo, walletRepository: walletRepo, rbacService, config: baseConfig });

  const rawPassword = "P@ssword12345!";
  const hash = await authService.hashPassword(rawPassword);

  assert.ok(hash.startsWith("$2b$") || hash.startsWith("$2a$"));
  assert.notEqual(hash, rawPassword);

  const isValid = await authService.verifyPassword(rawPassword, hash);
  assert.equal(isValid, true);

  const isInvalid = await authService.verifyPassword("WrongPassword123!", hash);
  assert.equal(isInvalid, false);
});

test("UserAuthService: register creates user and automatic wallet", async () => {
  const userRepo = new UserRepository(null);
  const walletRepo = new WalletRepository(null);
  const rbacService = new RbacService({ rbacRepository: new RbacRepository(null) });
  const authService = new UserAuthService({ userRepository: userRepo, walletRepository: walletRepo, rbacService, config: baseConfig });

  const result = await authService.register({
    email: "testuser@example.com",
    username: "testuser",
    password: "SecurePassword123!",
    fullName: "Test User Full"
  });

  assert.ok(result.user);
  assert.equal(result.user.email, "testuser@example.com");
  assert.equal(result.user.username, "testuser");
  assert.equal(result.user.role, "CUSTOMER");
  assert.equal(result.user.status, "ACTIVE");
  assert.ok(!result.user.passwordHash, "Must not leak password hash");

  assert.ok(result.wallet);
  assert.equal(result.wallet.balance, 0);
  assert.equal(result.wallet.lockedBalance, 0);

  assert.ok(result.accessToken);
  assert.ok(result.refreshToken);

  // Duplicate email should reject
  await assert.rejects(
    async () => {
      await authService.register({
        email: "testuser@example.com",
        username: "testuser2",
        password: "SecurePassword123!"
      });
    },
    (err) => err.code === "EMAIL_EXISTS"
  );

  // Duplicate username should reject
  await assert.rejects(
    async () => {
      await authService.register({
        email: "testuser2@example.com",
        username: "testuser",
        password: "SecurePassword123!"
      });
    },
    (err) => err.code === "USERNAME_EXISTS"
  );
});

test("UserAuthService: login with username or email", async () => {
  const userRepo = new UserRepository(null);
  const walletRepo = new WalletRepository(null);
  const rbacService = new RbacService({ rbacRepository: new RbacRepository(null) });
  const authService = new UserAuthService({ userRepository: userRepo, walletRepository: walletRepo, rbacService, config: baseConfig });

  await authService.register({
    email: "loginuser@example.com",
    username: "loginuser",
    password: "LoginPassword123!"
  });

  // Login via email
  const loginByEmail = await authService.login({
    login: "loginuser@example.com",
    password: "LoginPassword123!"
  });
  assert.ok(loginByEmail.accessToken);
  assert.equal(loginByEmail.user.username, "loginuser");

  // Login via username
  const loginByUsername = await authService.login({
    login: "loginuser",
    password: "LoginPassword123!"
  });
  assert.ok(loginByUsername.accessToken);
  assert.equal(loginByUsername.user.email, "loginuser@example.com");

  // Wrong password
  await assert.rejects(
    async () => {
      await authService.login({
        login: "loginuser",
        password: "WrongPassword999!"
      });
    },
    (err) => err.code === "INVALID_CREDENTIALS"
  );
});

test("UserAuthService: refresh token rotation and revocation", async () => {
  const userRepo = new UserRepository(null);
  const walletRepo = new WalletRepository(null);
  const rbacService = new RbacService({ rbacRepository: new RbacRepository(null) });
  const authService = new UserAuthService({ userRepository: userRepo, walletRepository: walletRepo, rbacService, config: baseConfig });

  const registerResult = await authService.register({
    email: "refreshuser@example.com",
    username: "refreshuser",
    password: "RefreshPassword123!"
  });

  const oldRefreshToken = registerResult.refreshToken;

  // Refresh token rotation
  const refreshResult = await authService.refreshTokens({ refreshToken: oldRefreshToken });
  assert.ok(refreshResult.accessToken);
  assert.ok(refreshResult.refreshToken);
  assert.notEqual(refreshResult.refreshToken, oldRefreshToken);

  // Reusing old refresh token must fail (Token Reuse Detection / Revocation)
  await assert.rejects(
    async () => {
      await authService.refreshTokens({ refreshToken: oldRefreshToken });
    },
    (err) => err.code === "INVALID_REFRESH_TOKEN"
  );
});

test("UserAuthService: suspended or banned user rejected", async () => {
  const userRepo = new UserRepository(null);
  const walletRepo = new WalletRepository(null);
  const rbacService = new RbacService({ rbacRepository: new RbacRepository(null) });
  const authService = new UserAuthService({ userRepository: userRepo, walletRepository: walletRepo, rbacService, config: baseConfig });

  const { user } = await authService.register({
    email: "banned@example.com",
    username: "banneduser",
    password: "BannedPassword123!"
  });

  // Ban user
  await userRepo.updateUser(user.id, { status: "BANNED" });

  await assert.rejects(
    async () => {
      await authService.login({
        login: "banneduser",
        password: "BannedPassword123!"
      });
    },
    (err) => err.code === "ACCOUNT_BANNED"
  );
});
