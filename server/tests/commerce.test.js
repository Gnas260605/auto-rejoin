import test from "node:test";
import assert from "node:assert/strict";
import { encryptSecret, decryptSecret } from "../src/utils/crypto.js";
import { CommerceService } from "../src/services/commerce.service.js";

test("AES-256-GCM encryption and decryption roundtrip", () => {
  const secret = "BF-VIP-SECRET-KEY-123456";
  const customKey = "test_super_secret_encryption_key_32bytes!";
  
  const encrypted = encryptSecret(secret, customKey);
  assert.ok(encrypted.encryptedSecret);
  assert.ok(encrypted.iv);
  assert.ok(encrypted.authTag);
  assert.equal(encrypted.secretLast4, "3456");

  const decrypted = decryptSecret(encrypted.encryptedSecret, encrypted.iv, encrypted.authTag, customKey);
  assert.equal(decrypted, secret);
});

test("CommerceService: createOrder calculates total correctly and sets status to pending", async () => {
  const mockCommerceRepo = {
    getVariantById: async (id) => {
      if (id === 1) {
        return { id: 1, productId: 10, sku: "TEST-SKU", price: 50000, isActive: true };
      }
      return null;
    },
    getProductById: async (id) => {
      if (id === 10) {
        return { id: 10, name: "Test Product", slug: "test-product", status: "ACTIVE", type: "DIGITAL_KEY" };
      }
      return null;
    },
    createOrder: async (data) => 123,
    addOrderItem: async () => {}
  };

  const service = new CommerceService({
    commerceRepository: mockCommerceRepo,
    licenseRepository: {},
    paymentRepository: {},
    config: { license: { keyPepper: "sample_pepper_for_test" } }
  });

  const order = await service.createOrder({
    items: [{ variantId: 1, quantity: 2 }],
    customerEmail: "user@test.com"
  });

  assert.equal(order.totalAmount, 100000);
  assert.equal(order.status, "pending");
  assert.ok(order.orderCode.startsWith("ORD-"));
  assert.ok(order.qrUrl.includes("amount=100000"));
});
