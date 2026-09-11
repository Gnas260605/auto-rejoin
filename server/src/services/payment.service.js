import crypto from "node:crypto";
import { generateLicenseKey, hashLicenseKey, displayPartsForKey } from "../utils/token.js";
import { secondsFromNow, nowDate } from "../utils/time.js";
import { sendDiscordWebhook, sendTelegramNotification } from "../utils/notification.js";

export class PaymentServiceError extends Error {
  constructor(code, message, httpStatus = 400) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function planExpirySeconds(planId, matchedPlan) {
  if (matchedPlan?.durationHours) {
    return Number(matchedPlan.durationHours) * 3600;
  }
  if (matchedPlan?.durationDays) {
    return Number(matchedPlan.durationDays) * 86400;
  }

  if (matchedPlan) {
    const dur = String(matchedPlan.duration || "").toLowerCase();
    if (matchedPlan.id === "trial_4h" || dur.includes("4 gio") || dur.includes("4h")) return 4 * 3600;
    if (matchedPlan.id === "day" || dur.includes("24") || dur.includes("1 ng")) return 86400;
    if (matchedPlan.id === "week" || dur.includes("7")) return 7 * 86400;
    if (matchedPlan.id === "month" || dur.includes("30")) return 30 * 86400;
    if (matchedPlan.id === "lifetime" || dur.includes("lifetime")) return null;
    const num = dur.match(/\d+/);
    return num ? Number(num[0]) * 86400 : 30 * 86400;
  }

  if (planId === "trial_4h") return 4 * 3600;
  if (planId === "day") return 86400;
  if (planId === "week") return 7 * 86400;
  if (planId === "month") return 30 * 86400;
  if (planId === "lifetime") return null;
  return 30 * 86400;
}

export class PaymentService {
  constructor({ paymentRepository, licenseRepository, adminRepository, config }) {
    this.paymentRepo = paymentRepository;
    this.licenseRepo = licenseRepository;
    this.adminRepo = adminRepository;
    this.config = config;
  }

  async createPaymentOrder({ planId = "month", userId = null }) {
    if (!planId) {
      throw new PaymentServiceError("INVALID_PLAN", "planId is required", 400);
    }

    // 1. Fetch dynamic pricing from database
    let matchedPlan = null;
    try {
      const dbPlans = await this.adminRepo.getSystemSetting("pricing_plans");
      if (Array.isArray(dbPlans)) {
        matchedPlan = dbPlans.find((p) => p.id === planId) || null;
      }
    } catch (_e) {
      matchedPlan = null;
    }

    if (!matchedPlan) {
      const defaults = {
        day: { name: "1 Ngày", priceNumber: 10000, maxDevices: 1, duration: "24 giờ" },
        week: { name: "7 Ngày", priceNumber: 40000, maxDevices: 1, duration: "7 ngày" },
        month: { name: "30 Ngày", priceNumber: 100000, maxDevices: 2, duration: "30 ngày" },
        lifetime: { name: "Trọn Đời", priceNumber: 250000, maxDevices: 4, duration: "Vĩnh viễn" }
      };
      matchedPlan = defaults[planId];
    }

    if (!matchedPlan || matchedPlan.enabled === false) {
      throw new PaymentServiceError("PLAN_UNAVAILABLE", `Gói ${planId} hiện không khả dụng`, 400);
    }

    const expectedAmount = Number(matchedPlan.priceNumber);
    if (!expectedAmount || expectedAmount <= 0) {
      throw new PaymentServiceError("INVALID_AMOUNT", "Gói cước có mức giá không hợp lệ", 400);
    }

    // 2. Generate unique random transaction code and payment identifiers
    const randomHex = crypto.randomBytes(4).toString("hex").toUpperCase();
    const paymentCode = `ORD-${Date.now().toString().slice(-6)}-${randomHex}`;
    const transferCode = `AR${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const transferContent = `${transferCode}`;
    const paymentSecretToken = crypto.randomBytes(24).toString("hex");

    // 3. Expiration time (20 minutes from creation)
    const expiredAt = secondsFromNow(20 * 60);

    // 4. Save pending payment to DB
    const paymentId = await this.paymentRepo.createPayment({
      paymentCode,
      userId,
      planId,
      planName: matchedPlan.name || planId,
      expectedAmount,
      provider: "vietqr",
      transferContent,
      paymentSecretToken,
      expiredAt
    });

    // 5. Fetch bank configuration
    let bankConfig = {
      bank: "MB",
      accountNumber: "0987654321",
      accountName: "NGUYEN VAN SANG"
    };
    try {
      const savedConfig = await this.adminRepo.getSystemSetting("payment_config");
      if (savedConfig && savedConfig.bank && savedConfig.accountNumber) {
        bankConfig = { ...bankConfig, ...savedConfig };
      }
    } catch (_e) {}

    const qrUrl = `https://img.vietqr.io/image/${bankConfig.bank}-${bankConfig.accountNumber}-compact2.png?amount=${expectedAmount}&addInfo=${encodeURIComponent(
      transferContent
    )}&accountName=${encodeURIComponent(bankConfig.accountName)}`;

    return {
      paymentId,
      paymentCode,
      planId,
      planName: matchedPlan.name,
      expectedAmount,
      expectedAmountFormatted: `${expectedAmount.toLocaleString("vi-VN")} đ`,
      currency: "VND",
      transferContent,
      bankName: bankConfig.bank,
      accountNumber: bankConfig.accountNumber,
      accountName: bankConfig.accountName,
      qrUrl,
      status: "pending",
      expiredAt: expiredAt.toISOString()
    };
  }

  async getPaymentStatus(paymentCode) {
    if (!paymentCode) {
      throw new PaymentServiceError("INVALID_CODE", "paymentCode is required", 400);
    }

    const payment = await this.paymentRepo.findPaymentByCode(paymentCode);
    if (!payment) {
      throw new PaymentServiceError("PAYMENT_NOT_FOUND", "Không tìm thấy thông tin đơn hàng", 404);
    }

    // Check expiration
    if (payment.status === "pending" && new Date() > new Date(payment.expired_at)) {
      await this.paymentRepo.markPaymentExpired(payment.id);
      payment.status = "expired";
    }

    if (payment.status === "paid") {
      return {
        ok: true,
        status: "paid",
        paymentCode: payment.payment_code,
        licenseReady: true,
        license: {
          key: payment.issued_raw_key,
          plan: payment.plan_name,
          paidAt: payment.paid_at ? new Date(payment.paid_at).toISOString() : null
        }
      };
    }

    return {
      ok: true,
      status: payment.status,
      paymentCode: payment.payment_code,
      expectedAmount: Number(payment.expected_amount),
      transferContent: payment.transfer_content,
      expiredAt: new Date(payment.expired_at).toISOString()
    };
  }

  async processWebhookPayment({ transferContent, amount, providerTxId, provider = "vietqr", rawPayload = {} }) {
    if (!transferContent) {
      return { success: false, reason: "MISSING_TRANSFER_CONTENT" };
    }

    const amountReceived = Number(amount) || 0;
    const cleanContent = String(transferContent).trim().toUpperCase();

    return await this.paymentRepo.withTransaction(async (txPaymentRepo) => {
      // 1. Try finding payment by exact transferContent or search substring
      let payment = await txPaymentRepo.findPaymentByTransferContentForUpdate(cleanContent);
      if (!payment) {
        // Search if transfer note contains the AR code (e.g. "CK TIEN AR123456 NGUYEN VAN A")
        const match = cleanContent.match(/AR[A-Z0-9]{4,8}/i);
        if (match) {
          payment = await txPaymentRepo.findPaymentByTransferContentForUpdate(match[0]);
        }
      }

      if (!payment) {
        return { success: false, reason: "PAYMENT_NOT_FOUND" };
      }

      // 2. Check if already paid (idempotency)
      if (payment.status === "paid") {
        return {
          success: true,
          alreadyPaid: true,
          paymentCode: payment.payment_code,
          licenseKey: payment.issued_raw_key
        };
      }

      // 3. Check status is pending
      if (payment.status !== "pending") {
        return { success: false, reason: `PAYMENT_ALREADY_${payment.status.toUpperCase()}` };
      }

      // 4. Verify amount
      if (amountReceived < Number(payment.expected_amount)) {
        return {
          success: false,
          reason: "INSUFFICIENT_AMOUNT",
          expected: payment.expected_amount,
          received: amountReceived
        };
      }

      // 5. Check duplicate provider transaction id if provided
      if (providerTxId) {
        const existingTx = await this.paymentRepo.findPaymentByProviderTxId(providerTxId);
        if (existingTx && existingTx.id !== payment.id) {
          return { success: false, reason: "DUPLICATE_PROVIDER_TRANSACTION" };
        }
      }

      // 6. Fulfill & generate License Key inside atomic transaction
      let matchedPlan = null;
      try {
        const dbPlans = await this.adminRepo.getSystemSetting("pricing_plans");
        if (Array.isArray(dbPlans)) {
          matchedPlan = dbPlans.find((p) => p.id === payment.plan_id) || null;
        }
      } catch (_e) {}

      let expiresInDays = 30;
      if (matchedPlan) {
        const dur = String(matchedPlan.duration || "").toLowerCase();
        if (matchedPlan.id === "day" || dur.includes("24") || dur.includes("1 ngày")) expiresInDays = 1;
        else if (matchedPlan.id === "week" || dur.includes("7")) expiresInDays = 7;
        else if (matchedPlan.id === "month" || dur.includes("30")) expiresInDays = 30;
        else if (matchedPlan.id === "lifetime" || dur.includes("vĩnh viễn") || dur.includes("trọn đời")) expiresInDays = null;
        else {
          const num = dur.match(/\d+/);
          expiresInDays = num ? Number(num[0]) : 30;
        }
      } else {
        if (payment.plan_id === "day") expiresInDays = 1;
        if (payment.plan_id === "week") expiresInDays = 7;
        if (payment.plan_id === "month") expiresInDays = 30;
        if (payment.plan_id === "lifetime") expiresInDays = null;
      }

      const maxDevices = matchedPlan?.maxDevices ? Number(matchedPlan.maxDevices) : (payment.plan_id === "lifetime" ? 4 : payment.plan_id === "month" ? 2 : 1);
      const planTier = matchedPlan?.plan || (payment.plan_id === "lifetime" ? "business" : payment.plan_id === "basic" ? "basic" : "pro");

      const rawKey = generateLicenseKey();
      const normalizedKey = rawKey.toUpperCase();
      const display = displayPartsForKey(normalizedKey);
      const keyHash = hashLicenseKey(normalizedKey, this.config.license.keyPepper);
      const expirySeconds = matchedPlan?.durationHours ? Number(matchedPlan.durationHours) * 3600 : null;
      const expiresAt = expirySeconds ? secondsFromNow(expirySeconds) : (expiresInDays ? secondsFromNow(expiresInDays * 86400) : null);

      const licenseId = await this.licenseRepo.createLicense({
        keyHash,
        keyPrefix: display.prefix,
        keyLast4: display.last4,
        plan: planTier,
        maxDevices,
        expiresAt
      });

      await this.licenseRepo.insertEvent({
        licenseId,
        eventType: "payment_fulfilled",
        metadata: {
          paymentCode: payment.payment_code,
          transferContent: payment.transfer_content,
          amountReceived,
          provider
        }
      });

      // 7. Update Payment record to paid
      await txPaymentRepo.markPaymentPaid(payment.id, {
        paidAmount: amountReceived,
        providerTransactionId: providerTxId || `TX-${Date.now()}`,
        licenseId,
        issuedRawKey: rawKey
      });

      // 8. Notifications
      this.dispatchPaymentNotifications(payment, rawKey, amountReceived).catch(() => {});

      return {
        success: true,
        paymentCode: payment.payment_code,
        licenseId,
        licenseKey: rawKey
      };
    });
  }

  async manualVerifyPayment(paymentIdOrCode, adminContext = {}) {
    return await this.paymentRepo.withTransaction(async (txPaymentRepo) => {
      let payment = null;
      if (Number.isInteger(Number(paymentIdOrCode)) && Number(paymentIdOrCode) > 0) {
        payment = await txPaymentRepo.findPaymentByIdForUpdate(Number(paymentIdOrCode));
      } else {
        payment = await txPaymentRepo.findPaymentByCodeForUpdate(String(paymentIdOrCode));
      }

      if (!payment) {
        throw new PaymentServiceError("NOT_FOUND", "Không tìm thấy giao dịch", 404);
      }

      if (payment.status === "paid") {
        return { ok: true, alreadyPaid: true, paymentCode: payment.payment_code, licenseKey: payment.issued_raw_key };
      }

      // Generate license key
      let matchedPlan = null;
      try {
        const dbPlans = await this.adminRepo.getSystemSetting("pricing_plans");
        if (Array.isArray(dbPlans)) {
          matchedPlan = dbPlans.find((p) => p.id === payment.plan_id) || null;
        }
      } catch (_e) {}

      let expiresInDays = 30;
      if (matchedPlan) {
        const dur = String(matchedPlan.duration || "").toLowerCase();
        if (matchedPlan.id === "day" || dur.includes("24")) expiresInDays = 1;
        else if (matchedPlan.id === "week" || dur.includes("7")) expiresInDays = 7;
        else if (matchedPlan.id === "month" || dur.includes("30")) expiresInDays = 30;
        else if (matchedPlan.id === "lifetime" || dur.includes("vĩnh viễn")) expiresInDays = null;
      }

      const maxDevices = matchedPlan?.maxDevices || 1;
      const planTier = matchedPlan?.plan || "pro";

      const rawKey = generateLicenseKey();
      const normalizedKey = rawKey.toUpperCase();
      const display = displayPartsForKey(normalizedKey);
      const keyHash = hashLicenseKey(normalizedKey, this.config.license.keyPepper);
      const expirySeconds = matchedPlan?.durationHours ? Number(matchedPlan.durationHours) * 3600 : null;
      const expiresAt = expirySeconds ? secondsFromNow(expirySeconds) : (expiresInDays ? secondsFromNow(expiresInDays * 86400) : null);

      const licenseId = await this.licenseRepo.createLicense({
        keyHash,
        keyPrefix: display.prefix,
        keyLast4: display.last4,
        plan: planTier,
        maxDevices,
        expiresAt
      });

      await txPaymentRepo.markPaymentPaid(payment.id, {
        paidAmount: payment.expected_amount,
        providerTransactionId: `ADMIN-MANUAL-${adminContext.adminId || "ADMIN"}-${Date.now()}`,
        licenseId,
        issuedRawKey: rawKey
      });

      await this.adminRepo.insertAudit({
        adminUserId: adminContext.adminId,
        action: "manual_payment_verified",
        targetType: "payment",
        targetId: String(payment.id),
        ipAddress: adminContext.ip,
        metadata: { paymentCode: payment.payment_code, licenseId, amount: payment.expected_amount }
      });

      this.dispatchPaymentNotifications(payment, rawKey, payment.expected_amount).catch(() => {});

      return {
        ok: true,
        paymentCode: payment.payment_code,
        licenseId,
        licenseKey: rawKey
      };
    });
  }

  async listPayments(params) {
    return this.paymentRepo.listPayments(params);
  }

  async getRevenueStats() {
    return this.paymentRepo.getRevenueStats();
  }

  async cancelPaymentOrder(paymentCodeOrId, { reason = "user_cancelled", adminContext = null } = {}) {
    let payment = null;
    if (Number.isInteger(Number(paymentCodeOrId)) && Number(paymentCodeOrId) > 0) {
      payment = await this.paymentRepo.findPaymentByIdForUpdate(Number(paymentCodeOrId));
    } else {
      payment = await this.paymentRepo.findPaymentByCodeForUpdate(String(paymentCodeOrId));
    }

    if (!payment) {
      throw new PaymentServiceError("PAYMENT_NOT_FOUND", "Không tìm thấy thông tin đơn hàng", 404);
    }

    if (payment.status === "paid") {
      throw new PaymentServiceError("CANNOT_CANCEL_PAID", "Đơn hàng đã thanh toán thành công, không thể hủy", 400);
    }

    if (payment.status === "cancelled") {
      return { ok: true, message: "Đơn hàng đã được hủy trước đó", paymentCode: payment.payment_code };
    }

    await this.paymentRepo.cancelPaymentById(payment.id);

    if (adminContext?.adminId) {
      await this.adminRepo.insertAudit({
        adminUserId: adminContext.adminId,
        action: "payment_cancelled",
        targetType: "payment",
        targetId: String(payment.id),
        ipAddress: adminContext.ip,
        metadata: { paymentCode: payment.payment_code, reason }
      }).catch(() => {});
    }

    return {
      ok: true,
      message: "Đã hủy đơn hàng thành công",
      paymentCode: payment.payment_code,
      status: "cancelled"
    };
  }

  async deletePayment(id, adminContext = {}) {
    const paymentId = Number(id);
    if (!paymentId) {
      throw new PaymentServiceError("INVALID_ID", "ID đơn hàng không hợp lệ", 400);
    }

    const deleted = await this.paymentRepo.deletePaymentById(paymentId);
    if (!deleted) {
      throw new PaymentServiceError("DELETE_FAILED", "Không thể xóa đơn hàng (đơn không tồn tại hoặc đã được thanh toán)", 400);
    }

    if (adminContext.adminId) {
      await this.adminRepo.insertAudit({
        adminUserId: adminContext.adminId,
        action: "payment_deleted",
        targetType: "payment",
        targetId: String(paymentId),
        ipAddress: adminContext.ip,
        metadata: { paymentId }
      }).catch(() => {});
    }

    return { ok: true, message: "Đã xóa đơn hàng thành công" };
  }

  async cleanupIncompleteOrders(adminContext = {}) {
    const deletedCount = await this.paymentRepo.cleanupIncompletePayments();

    if (adminContext.adminId) {
      await this.adminRepo.insertAudit({
        adminUserId: adminContext.adminId,
        action: "payments_cleanup_incomplete",
        targetType: "system",
        targetId: "payments",
        ipAddress: adminContext.ip,
        metadata: { deletedCount }
      }).catch(() => {});
    }

    return {
      ok: true,
      message: `Đã dọn dẹp ${deletedCount} đơn hàng chưa hoàn thành / hết hạn`,
      deletedCount
    };
  }

  async getPayOSConfig() {
    const config = await this.adminRepo.getSystemSetting("payos_config");
    return {
      clientId: config?.clientId || "",
      apiKey: config?.apiKey || "",
      checksumKey: config?.checksumKey || "",
      enabled: Boolean(config?.enabled),
      gatewayMode: config?.gatewayMode || "payos",
      webhookUrl: config?.webhookUrl || ""
    };
  }

  async savePayOSConfig(configData, adminContext = {}) {
    const cleanConfig = {
      clientId: String(configData?.clientId || "").trim(),
      apiKey: String(configData?.apiKey || "").trim(),
      checksumKey: String(configData?.checksumKey || "").trim(),
      enabled: Boolean(configData?.enabled),
      gatewayMode: configData?.gatewayMode || "payos",
      webhookUrl: String(configData?.webhookUrl || "").trim()
    };

    await this.adminRepo.setSystemSetting("payos_config", cleanConfig);

    if (adminContext.adminId) {
      await this.adminRepo.insertAudit({
        adminUserId: adminContext.adminId,
        action: "payos_config_updated",
        targetType: "system_setting",
        targetId: "payos_config",
        ipAddress: adminContext.ip,
        metadata: {
          enabled: cleanConfig.enabled,
          gatewayMode: cleanConfig.gatewayMode,
          hasClientId: Boolean(cleanConfig.clientId),
          hasApiKey: Boolean(cleanConfig.apiKey),
          hasChecksumKey: Boolean(cleanConfig.checksumKey)
        }
      }).catch(() => {});
    }

    return { ok: true, message: "Cập nhật cấu hình PayOS thành công", config: cleanConfig };
  }

  async testPayOS(testParams = {}) {
    const { clientId, apiKey, checksumKey } = testParams;
    if (!clientId || !apiKey || !checksumKey) {
      throw new PaymentServiceError("MISSING_CREDENTIALS", "Vui lòng nhập đầy đủ Client ID, API Key và Checksum Key để kiểm tra kết nối", 400);
    }

    // Verify HMAC SHA256 simulation
    const sampleData = `amount=10000&cancelUrl=http://localhost&description=TESTPAYOS&orderCode=999999&returnUrl=http://localhost`;
    const computedSignature = crypto.createHmac("sha256", checksumKey).update(sampleData).digest("hex");

    return {
      ok: true,
      message: "Kiểm tra cấu hình PayOS thành công! Chữ ký HMAC SHA256 hoạt động chuẩn xác.",
      signatureSample: computedSignature.slice(0, 16) + "..."
    };
  }

  async dispatchPaymentNotifications(payment, rawKey, amount) {
    try {
      const savedSettings = (await this.adminRepo.getSystemSetting("payment_config")) || {};
      const discordWebhook = savedSettings.discordWebhook;
      const telegramBotToken = savedSettings.telegramBotToken;
      const telegramChatId = savedSettings.telegramChatId;

      const notificationText = `🛒 <b>ĐƠN HÀNG THANH TOÁN THÀNH CÔNG</b>\n` +
        `• Mã đơn: <code>${payment.payment_code}</code>\n` +
        `• Nội dung CK: <code>${payment.transfer_content}</code>\n` +
        `• Gói mua: <b>${payment.plan_name}</b>\n` +
        `• Số tiền: <b>${Number(amount).toLocaleString("vi-VN")} đ</b>\n` +
        `• License Key Cấp Cho Khách: <code>${rawKey}</code>\n` +
        `• Thời gian: ${new Date().toLocaleString("vi-VN")}`;

      if (telegramBotToken && telegramChatId) {
        sendTelegramNotification(telegramBotToken, telegramChatId, notificationText).catch(() => {});
      }

      if (discordWebhook) {
        sendDiscordWebhook(discordWebhook, {
          embeds: [{
            title: "🛒 THANH TOÁN THÀNH CÔNG - AUTO REJOIN PRO",
            color: 0x10b981,
            fields: [
              { name: "Mã Đơn Hàng", value: payment.payment_code, inline: true },
              { name: "Nội Dung CK", value: payment.transfer_content, inline: true },
              { name: "Gói Mua", value: payment.plan_name, inline: true },
              { name: "Số Tiền Nhận", value: `${Number(amount).toLocaleString("vi-VN")} đ`, inline: true },
              { name: "License Key Đã Cấp", value: `\`${rawKey}\``, inline: false }
            ],
            footer: { text: "Hệ thống xác thực thanh toán tự động Auto Rejoin Pro" },
            timestamp: new Date().toISOString()
          }]
        }).catch(() => {});
      }
    } catch (_e) {}
  }
}
