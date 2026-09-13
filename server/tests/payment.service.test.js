import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { PaymentService } from "../src/services/payment.service.js";

function signPayOSData(data, checksumKey) {
  const canonical = Object.keys(data)
    .sort()
    .map((key) => `${key}=${data[key] ?? ""}`)
    .join("&");
  return crypto.createHmac("sha256", checksumKey).update(canonical).digest("hex");
}

function createService(payosConfig) {
  return new PaymentService({
    paymentRepository: {},
    licenseRepository: {},
    adminRepository: {
      async getSystemSetting(key) {
        if (key === "payos_config") {
          return payosConfig;
        }
        return null;
      }
    },
    config: {
      license: {
        keyPepper: "test_pepper_32_chars_minimum_value"
      }
    }
  });
}

test("PayOS webhook signature passes for enabled config and valid signature", async () => {
  const checksumKey = "payos_checksum_secret_32_chars_min";
  const data = {
    amount: 10000,
    description: "ARABC123",
    orderCode: 123456,
    reference: "TX123"
  };
  const service = createService({ enabled: true, checksumKey });

  const result = await service.verifyPayOSWebhookSignature({
    data,
    signature: signPayOSData(data, checksumKey)
  });

  assert.deepEqual(result, { ok: true });
});

test("PayOS webhook signature rejects missing signature when enabled", async () => {
  const service = createService({ enabled: true, checksumKey: "payos_checksum_secret_32_chars_min" });

  const result = await service.verifyPayOSWebhookSignature({
    data: { amount: 10000, description: "ARABC123" }
  });

  assert.deepEqual(result, { ok: false, reason: "MISSING_SIGNATURE" });
});

test("PayOS webhook signature rejects invalid signature", async () => {
  const service = createService({ enabled: true, checksumKey: "payos_checksum_secret_32_chars_min" });

  const result = await service.verifyPayOSWebhookSignature({
    data: { amount: 10000, description: "ARABC123" },
    signature: "00".repeat(32)
  });

  assert.deepEqual(result, { ok: false, reason: "INVALID_SIGNATURE" });
});

test("PayOS webhook signature is skipped when gateway is not configured", async () => {
  const service = createService({ enabled: false, checksumKey: "" });

  const result = await service.verifyPayOSWebhookSignature({
    data: { amount: 10000, description: "ARABC123" }
  });

  assert.deepEqual(result, { ok: true, skipped: true });
});
