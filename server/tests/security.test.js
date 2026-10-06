import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../src/app.js";
import { signAdminToken } from "../src/utils/admin-auth.js";
import { UserAuthService } from "../src/services/user-auth.service.js";

// Cố ý dùng CHUNG secret cho admin và khách hàng: đây là cấu hình mặc định cũ gây ra lỗ hổng.
const SHARED_SECRET = "shared_jwt_secret_used_by_admin_and_customer!";
const WEBHOOK_SECRET = "bank_webhook_shared_secret_value_123";

function makeConfig(overrides = {}) {
  return {
    nodeEnv: "test",
    license: { keyPepper: "test_pepper_12345678901234567890", maintenance: { enabled: false } },
    admin: { jwtSecret: SHARED_SECRET, tokenTtlSeconds: 3600, origins: ["*"], cookieSecure: false, cookieSameSite: "lax" },
    customer: { jwtSecret: SHARED_SECRET, cookieSecure: false, cookieSameSite: "lax" },
    payment: { webhookSecret: WEBHOOK_SECRET },
    rateLimit: { enabled: false },
    ...overrides
  };
}

const adminRepository = {
  async findAdminById(id) {
    return Number(id) === 1 ? { id: 1, username: "root", role: "super_admin", status: "active" } : null;
  }
};

function makePaymentRepository() {
  const repo = {
    lookups: [],
    async withTransaction(fn) {
      return fn(repo);
    },
    async findPaymentByTransferContentForUpdate(content) {
      repo.lookups.push(content);
      return null;
    }
  };
  return repo;
}

function makeApp({ config = makeConfig(), paymentRepository = makePaymentRepository() } = {}) {
  const app = createApp({
    repository: {},
    adminRepository,
    paymentRepository,
    commerceRepository: {},
    userRepository: {},
    walletRepository: {},
    rbacRepository: {},
    config
  });
  return { app, paymentRepository };
}

test("Security: customer access token is rejected on admin API even with shared secret", async () => {
  const { app } = makeApp();
  const customerService = new UserAuthService({ config: makeConfig() });
  // Khách hàng có id 1 trùng id super_admin.
  const customerToken = customerService.generateAccessToken({ id: 1, email: "a@b.c", username: "a", role: "customer" });

  await request(app).get("/api/v1/admin/meta/plans").set("Authorization", `Bearer ${customerToken}`).expect(401);
});

test("Security: legacy admin token without type is rejected", async () => {
  const { app } = makeApp();
  const legacy = jwt.sign({ sub: "1", username: "root", role: "super_admin" }, SHARED_SECRET, { algorithm: "HS256", expiresIn: 3600 });

  await request(app).get("/api/v1/admin/meta/plans").set("Authorization", `Bearer ${legacy}`).expect(401);
});

test("Security: real admin token still works", async () => {
  const { app } = makeApp();
  const token = signAdminToken({ id: 1, username: "root", role: "super_admin" }, SHARED_SECRET, 3600);

  await request(app).get("/api/v1/admin/meta/plans").set("Authorization", `Bearer ${token}`).expect(200);
});

test("Security: admin token is not accepted as customer token", () => {
  const customerService = new UserAuthService({ config: makeConfig() });
  const adminToken = signAdminToken({ id: 1, username: "root", role: "super_admin" }, SHARED_SECRET, 3600);

  assert.throws(() => customerService.verifyAccessToken(adminToken), /invalid token type/);
});

const fakeBankPayload = { content: "AR123ABC", amount: 250000, id: "TX-1" };

test("Security: bank webhook without secret is rejected and never touches payments", async () => {
  const { app, paymentRepository } = makeApp();

  await request(app).post("/api/v1/payments/webhook").send(fakeBankPayload).expect(401);
  assert.equal(paymentRepository.lookups.length, 0);
});

test("Security: bank webhook with wrong secret is rejected", async () => {
  const { app, paymentRepository } = makeApp();

  await request(app).post("/api/v1/payments/webhook").set("Authorization", "Apikey wrong").send(fakeBankPayload).expect(401);
  assert.equal(paymentRepository.lookups.length, 0);
});

test("Security: bank webhook accepts SePay, Casso and Bearer secret formats", async () => {
  for (const [header, value] of [
    ["Authorization", `Apikey ${WEBHOOK_SECRET}`],
    ["Authorization", `Bearer ${WEBHOOK_SECRET}`],
    ["secure-token", WEBHOOK_SECRET],
    ["x-webhook-secret", WEBHOOK_SECRET]
  ]) {
    const { app, paymentRepository } = makeApp();
    const res = await request(app).post("/api/v1/payments/webhook").set(header, value).send(fakeBankPayload).expect(200);
    assert.equal(res.body.reason, "PAYMENT_NOT_FOUND", `${header} reaches payment processing`);
    assert.equal(paymentRepository.lookups[0], "AR123ABC");
  }
});

test("Security: bank webhook is disabled in production when no secret is configured", async () => {
  const { app, paymentRepository } = makeApp({ config: makeConfig({ nodeEnv: "production", payment: { webhookSecret: "" } }) });

  const res = await request(app).post("/api/v1/payments/webhook").send(fakeBankPayload).expect(503);
  assert.equal(res.body.code, "WEBHOOK_DISABLED");
  assert.equal(paymentRepository.lookups.length, 0);
});

function makeOrderApp(paymentOverrides = {}) {
  const payment = {
    id: 7,
    payment_code: "ORD-123456-ABCD1234",
    status: "paid",
    issued_raw_key: "AR-SECRET-KEY-0001",
    plan_name: "30 Ngày",
    paid_at: new Date(),
    expired_at: new Date(Date.now() + 600000),
    payment_secret_token: "owner_token_0123456789abcdef",
    ...paymentOverrides
  };
  const paymentRepository = {
    cancelled: [],
    async findPaymentByCode(code) {
      return code === payment.payment_code ? payment : null;
    },
    async findPaymentByCodeForUpdate(code) {
      return code === payment.payment_code ? payment : null;
    },
    async findPaymentByIdForUpdate(id) {
      return Number(id) === payment.id ? payment : null;
    },
    async cancelPaymentById(id) {
      paymentRepository.cancelled.push(id);
    }
  };
  return makeApp({ paymentRepository });
}

test("Security: payment status hides license key without the owner token", async () => {
  const { app } = makeOrderApp();

  const res = await request(app).get("/api/v1/payments/ORD-123456-ABCD1234/status").expect(200);
  assert.equal(res.body.status, "paid");
  assert.equal(res.body.license.key, null);
  assert.equal(res.body.tokenRequired, true);
});

test("Security: payment status reveals license key to the order owner", async () => {
  const { app } = makeOrderApp();

  const res = await request(app)
    .get("/api/v1/payments/ORD-123456-ABCD1234/status")
    .set("X-Payment-Token", "owner_token_0123456789abcdef")
    .expect(200);
  assert.equal(res.body.license.key, "AR-SECRET-KEY-0001");
});

test("Security: public cancel by numeric id or code requires the owner token", async () => {
  const { app, paymentRepository } = makeOrderApp({ status: "pending", issued_raw_key: null });

  await request(app).post("/api/v1/payments/7/cancel").expect(403);
  await request(app).post("/api/v1/payments/ORD-123456-ABCD1234/cancel").set("X-Payment-Token", "guess").expect(403);
  assert.deepEqual(paymentRepository.cancelled, []);

  await request(app)
    .post("/api/v1/payments/ORD-123456-ABCD1234/cancel")
    .set("X-Payment-Token", "owner_token_0123456789abcdef")
    .expect(200);
  assert.deepEqual(paymentRepository.cancelled, [7]);
});

test("Security: issued license keys are sealed at rest and readable only with the right key", async () => {
  const { sealValue, openSealedValue, isSealedValue } = await import("../src/utils/crypto.js");
  const sealed = sealValue("AR-ABCD-EFGH-IJKL-MNOP", "secret_one_32_chars_minimum_value!");

  assert.ok(isSealedValue(sealed));
  assert.ok(!sealed.includes("AR-ABCD"));
  assert.equal(openSealedValue(sealed, "secret_one_32_chars_minimum_value!"), "AR-ABCD-EFGH-IJKL-MNOP");
  assert.equal(openSealedValue(sealed, "wrong_secret_32_chars_minimum_val!"), null);
  assert.equal(openSealedValue("AR-LEGACY-PLAINTEXT", "any"), "AR-LEGACY-PLAINTEXT");
});

test("Security: payment service seals keys it writes and reveals them to the order owner", async () => {
  const { PaymentService } = await import("../src/services/payment.service.js");
  const service = new PaymentService({ config: makeConfig() });
  const sealed = service.sealIssuedKey("AR-SEALED-KEY-0002");
  assert.ok(sealed.startsWith("enc:v1:"));

  const { app } = makeOrderApp({ issued_raw_key: sealed });
  const res = await request(app)
    .get("/api/v1/payments/ORD-123456-ABCD1234/status")
    .set("X-Payment-Token", "owner_token_0123456789abcdef")
    .expect(200);
  assert.equal(res.body.license.key, "AR-SEALED-KEY-0002");
});
