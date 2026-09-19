import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.js";
import { UserRepository } from "../src/repositories/user.repository.js";
import { WalletRepository } from "../src/repositories/wallet.repository.js";
import { RbacRepository } from "../src/repositories/rbac.repository.js";
import { hashPassword } from "../src/utils/admin-auth.js";

const TEST_SECRET = "customer_integration_jwt_secret_32_bytes!!";

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
  constructor(admins = []) {
    this.admins = [...admins];
  }
  async findAdminByUsername(username) {
    return this.admins.find((a) => a.username === username) || null;
  }
  async findAdminById(id) {
    return this.admins.find((a) => a.id === Number(id)) || null;
  }
  async updateAdminLastLogin() {}
  async insertAudit() {}
}

class MockCommerceRepository {
  async listProducts() {
    return [{ id: 1, name: "Auto Rejoin 30 Ngày", slug: "auto-rejoin-key" }];
  }
  async listPublicProducts() {
    return [{ id: 1, name: "Auto Rejoin 30 Ngày", slug: "auto-rejoin-key", is_active: 1 }];
  }
}

class MockPaymentRepository {
  async listPayments() { return []; }
}

test("Phase 1 Integration: Full customer authentication and wallet flow", async () => {
  const userRepo = new UserRepository(null);
  const walletRepo = new WalletRepository(null);
  const rbacRepo = new RbacRepository(null);
  const licenseRepo = new MockLicenseRepository();
  const adminRepo = new MockAdminRepository();
  const commerceRepo = new MockCommerceRepository();
  const paymentRepo = new MockPaymentRepository();

  const app = createApp({
    repository: licenseRepo,
    adminRepository: adminRepo,
    commerceRepository: commerceRepo,
    paymentRepository: paymentRepo,
    userRepository: userRepo,
    walletRepository: walletRepo,
    rbacRepository: rbacRepo,
    config: baseConfig
  });

  // 1. Register customer
  const regRes = await request(app)
    .post("/api/v1/auth/register")
    .send({
      email: "gamer@example.com",
      username: "gamerpro",
      password: "Password1234!",
      fullName: "Gamer Pro VN"
    })
    .expect(201);

  assert.equal(regRes.body.ok, true);
  assert.equal(regRes.body.user.username, "gamerpro");
  assert.equal(regRes.body.wallet.balance, 0);
  const accessToken = regRes.body.accessToken;
  const refreshToken = regRes.body.refreshToken;
  assert.ok(accessToken);
  assert.ok(refreshToken);

  // 2. Access /api/v1/me with accessToken
  const meRes = await request(app)
    .get("/api/v1/me")
    .set("Authorization", `Bearer ${accessToken}`)
    .expect(200);

  assert.equal(meRes.body.ok, true);
  assert.equal(meRes.body.user.username, "gamerpro");
  assert.equal(meRes.body.user.role, "CUSTOMER");
  assert.equal(meRes.body.wallet.balance, 0);

  // 3. Access /api/v1/wallet
  const walletRes = await request(app)
    .get("/api/v1/wallet")
    .set("Authorization", `Bearer ${accessToken}`)
    .expect(200);

  assert.equal(walletRes.body.ok, true);
  assert.equal(walletRes.body.wallet.balance, 0);

  // 4. Access /api/v1/wallet/transactions (empty initially)
  const txRes = await request(app)
    .get("/api/v1/wallet/transactions")
    .set("Authorization", `Bearer ${accessToken}`)
    .expect(200);

  assert.equal(txRes.body.ok, true);
  assert.equal(txRes.body.transactions.length, 0);

  // 5. Test Refresh Token
  const refreshRes = await request(app)
    .post("/api/v1/auth/refresh")
    .send({ refreshToken })
    .expect(200);

  assert.equal(refreshRes.body.ok, true);
  const newAccessToken = refreshRes.body.accessToken;
  const newRefreshToken = refreshRes.body.refreshToken;
  assert.ok(newAccessToken);
  assert.ok(newRefreshToken);
  assert.notEqual(newRefreshToken, refreshToken);

  // 6. Test Logout
  const logoutRes = await request(app)
    .post("/api/v1/auth/logout")
    .send({ refreshToken: newRefreshToken })
    .expect(200);

  assert.equal(logoutRes.body.ok, true);

  // 7. Security Isolation: Customer token CANNOT access admin APIs
  const adminAccessRes = await request(app)
    .get("/api/v1/admin/licenses")
    .set("Authorization", `Bearer ${newAccessToken}`)
    .expect(401);

  assert.equal(adminAccessRes.body.ok, false);
});

test("Phase 1 Regression: Admin authentication and Commerce catalog unchanged", async () => {
  const adminPassHash = await hashPassword("AdminSecret123!");
  const adminRepo = new MockAdminRepository([
    { id: 1, username: "admin", password_hash: adminPassHash, role: "admin", status: "active" }
  ]);
  const userRepo = new UserRepository(null);
  const walletRepo = new WalletRepository(null);
  const rbacRepo = new RbacRepository(null);
  const licenseRepo = new MockLicenseRepository();
  const commerceRepo = new MockCommerceRepository();
  const paymentRepo = new MockPaymentRepository();

  const app = createApp({
    repository: licenseRepo,
    adminRepository: adminRepo,
    commerceRepository: commerceRepo,
    paymentRepository: paymentRepo,
    userRepository: userRepo,
    walletRepository: walletRepo,
    rbacRepository: rbacRepo,
    config: baseConfig
  });

  // Admin login still functions perfectly
  const adminLoginRes = await request(app)
    .post("/api/v1/admin/auth/login")
    .send({ username: "admin", password: "AdminSecret123!" })
    .expect(200);

  assert.equal(adminLoginRes.body.ok, true);
  assert.equal(adminLoginRes.body.admin.username, "admin");

  // Commerce products catalog endpoint still functions
  const storeRes = await request(app)
    .get("/api/v1/store/products")
    .expect(200);

  assert.equal(storeRes.body.ok, true);
  assert.ok(Array.isArray(storeRes.body.products));
});
