import crypto from "node:crypto";
import { encryptSecret, decryptSecret } from "../utils/crypto.js";
import { generateLicenseKey, hashLicenseKey, displayPartsForKey } from "../utils/token.js";
import { secondsFromNow, isoNow } from "../utils/time.js";

export class CommerceService {
  constructor({ commerceRepository, licenseRepository, paymentRepository, config }) {
    this.commerceRepo = commerceRepository;
    this.licenseRepo = licenseRepository;
    this.paymentRepo = paymentRepository;
    this.config = config;
  }

  async getCatalog() {
    return this.commerceRepo.listPublicProducts();
  }

  async getProductDetails(slug) {
    const product = await this.commerceRepo.getProductBySlug(slug);
    if (!product || !product.isPublic) {
      const err = new Error("Product not found");
      err.statusCode = 404;
      err.code = "PRODUCT_NOT_FOUND";
      throw err;
    }
    return product;
  }

  async createOrder({ items, customerEmail, customerName, customerPhone, paymentMethod = "vietqr" }) {
    if (!Array.isArray(items) || items.length === 0) {
      const err = new Error("Order must contain at least one item");
      err.statusCode = 400;
      err.code = "EMPTY_ORDER";
      throw err;
    }

    let calculatedTotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const variant = await this.commerceRepo.getVariantById(item.variantId);
      if (!variant || !variant.isActive) {
        const err = new Error(`Variant ${item.variantId} is invalid or inactive`);
        err.statusCode = 400;
        err.code = "INVALID_VARIANT";
        throw err;
      }

      const product = await this.commerceRepo.getProductById(variant.productId);
      if (!product || product.status !== "ACTIVE") {
        const err = new Error(`Product for variant ${variant.sku} is not available`);
        err.statusCode = 400;
        err.code = "PRODUCT_UNAVAILABLE";
        throw err;
      }

      const quantity = Math.max(1, Number.parseInt(item.quantity, 10) || 1);
      const itemTotal = variant.price * quantity;
      calculatedTotal += itemTotal;

      validatedItems.push({
        productId: product.id,
        variantId: variant.id,
        quantity,
        unitPrice: variant.price,
        totalPrice: itemTotal,
        fulfillmentType: product.type,
        product,
        variant
      });
    }

    const orderSuffix = crypto.randomBytes(4).toString("hex").toUpperCase();
    const orderCode = `ORD-${Date.now().toString().slice(-6)}-${orderSuffix}`;
    const transferContent = `AR${orderSuffix}${Math.floor(100 + Math.random() * 900)}`;
    const expiredAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const orderId = await this.commerceRepo.createOrder({
      orderCode,
      customerEmail,
      customerName,
      customerPhone,
      totalAmount: calculatedTotal,
      paymentMethod,
      transferContent,
      expiredAt
    });

    for (const vItem of validatedItems) {
      await this.commerceRepo.addOrderItem({
        orderId,
        productId: vItem.productId,
        variantId: vItem.variantId,
        quantity: vItem.quantity,
        unitPrice: vItem.unitPrice,
        totalPrice: vItem.totalPrice,
        fulfillmentType: vItem.fulfillmentType,
        fulfillmentData: {
          productSlug: vItem.product.slug,
          variantSku: vItem.variant.sku,
          durationDays: vItem.variant.durationDays,
          maxDevices: vItem.variant.maxDevices
        }
      });
    }

    // Default Bank Account configuration for VietQR
    const bankConfig = {
      bankId: process.env.VIETQR_BANK_ID || "MB",
      accountNo: process.env.VIETQR_ACCOUNT_NO || "0987654321",
      accountName: process.env.VIETQR_ACCOUNT_NAME || "AUTO REJOIN PRO",
      amount: calculatedTotal,
      content: transferContent
    };

    const qrUrl = `https://img.vietqr.io/image/${bankConfig.bankId}-${bankConfig.accountNo}-compact2.png?amount=${calculatedTotal}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(bankConfig.accountName)}`;

    return {
      orderCode,
      totalAmount: calculatedTotal,
      currency: "VND",
      status: "pending",
      transferContent,
      qrUrl,
      bankConfig,
      expiredAt: expiredAt.toISOString()
    };
  }

  async getOrderStatus(orderCode) {
    const order = await this.commerceRepo.getOrderByCode(orderCode);
    if (!order) {
      const err = new Error("Order not found");
      err.statusCode = 404;
      err.code = "ORDER_NOT_FOUND";
      throw err;
    }

    if (order.status === "pending") {
      // In development / demo mode or via webhook, check if payment is confirmed
      // If expired
      if (new Date(order.expiredAt) < new Date()) {
        await this.commerceRepo.updateOrderStatus(order.id, "expired");
        order.status = "expired";
      }
    }

    return order;
  }

  async fulfillOrder(orderId) {
    const order = await this.commerceRepo.getOrderByCode(orderId);
    if (!order) {
      throw new Error("Order not found for fulfillment");
    }

    if (order.status === "fulfilled") {
      return order;
    }

    await this.commerceRepo.updateOrderStatus(order.id, "fulfilling", { paidAt: isoNow() });

    for (const item of order.items) {
      for (let i = 0; i < item.quantity; i += 1) {
        if (item.fulfillmentType === "LICENSE") {
          // Generate Auto Rejoin Pro License Key
          const rawKey = generateLicenseKey();
          const normalizedKey = rawKey.toUpperCase();
          const display = displayPartsForKey(normalizedKey);
          const durationDays = item.durationDays || 30;
          const plan = (item.variantSku && item.variantSku.includes("lifetime")) ? "lifetime" : "pro";

          const licenseId = await this.licenseRepo.createLicense({
            keyHash: hashLicenseKey(normalizedKey, this.config.license.keyPepper),
            keyPrefix: display.prefix,
            keyLast4: display.last4,
            plan: plan,
            maxDevices: item.variant?.maxDevices || 1,
            expiresAt: plan === "lifetime" ? null : secondsFromNow(durationDays * 86400),
            customerEmail: order.customerEmail || null,
            customerPhone: order.customerPhone || null
          });

          await this.commerceRepo.recordFulfillment({
            orderId: order.id,
            orderItemId: item.id,
            fulfillmentType: "LICENSE",
            status: "SUCCESS",
            deliveredPayload: {
              licenseId,
              rawKey,
              plan,
              durationDays,
              instructions: "Dán key này vào lệnh setup.sh hoặc roblox-manager license activate để kích hoạt."
            }
          });
        } else if (item.fulfillmentType === "DIGITAL_KEY") {
          // Deliver pre-stored encrypted serial key from inventory
          const inventoryItem = await this.commerceRepo.popAvailableInventoryItem(
            item.productId,
            item.variantId,
            order.id
          );

          if (inventoryItem) {
            const plainSecret = decryptSecret(
              inventoryItem.encryptedSecret,
              inventoryItem.iv,
              inventoryItem.authTag
            );

            await this.commerceRepo.recordFulfillment({
              orderId: order.id,
              orderItemId: item.id,
              fulfillmentType: "DIGITAL_KEY",
              status: "SUCCESS",
              deliveredPayload: {
                serialKey: plainSecret,
                secretLast4: inventoryItem.secretLast4,
                instructions: "Đây là mã Serial Key của bạn. Vui lòng lưu lại cẩn thận."
              }
            });
          } else {
            // Out of stock fallback
            await this.commerceRepo.recordFulfillment({
              orderId: order.id,
              orderItemId: item.id,
              fulfillmentType: "DIGITAL_KEY",
              status: "FAILED",
              errorMessage: "Tạm hết hàng trong kho. Vui lòng liên hệ hỗ trợ để nhận key thủ công."
            });
          }
        } else if (item.fulfillmentType === "DOWNLOAD") {
          await this.commerceRepo.recordFulfillment({
            orderId: order.id,
            orderItemId: item.id,
            fulfillmentType: "DOWNLOAD",
            status: "SUCCESS",
            deliveredPayload: {
              downloadUrl: "https://raw.githubusercontent.com/Gnas260605/auto-rejoin/main/setup.sh",
              fileName: "AutoRejoin_VIP_Script_Config.zip",
              instructions: "Bấm vào đường dẫn để tải về file script / cấu hình VIP của bạn."
            }
          });
        } else {
          // SERVICE / RESET HWID / SUBSCRIPTION
          let resetSuccess = false;
          const targetKey = order.metadata?.targetLicenseKey || order.customerEmail;
          if (targetKey && typeof targetKey === "string" && targetKey.startsWith("AR-")) {
            const normalized = targetKey.trim().toUpperCase();
            const keyHash = hashLicenseKey(normalized, this.config.license.keyPepper);
            const license = await this.licenseRepo.findLicenseByKeyHash(keyHash);
            if (license) {
              await this.licenseRepo.revokeAllDevicesForLicense(license.id);
              await this.licenseRepo.insertEvent({
                licenseId: license.id,
                eventType: "devices_reset_via_store",
                metadata: { orderCode: order.orderCode }
              });
              resetSuccess = true;
            }
          }

          await this.commerceRepo.recordFulfillment({
            orderId: order.id,
            orderItemId: item.id,
            fulfillmentType: item.fulfillmentType,
            status: "SUCCESS",
            deliveredPayload: {
              ticketCode: `RS-${order.orderCode}`,
              resetSuccess,
              targetKey: targetKey || null,
              instructions: resetSuccess
                ? `Đã reset thành công toàn bộ thiết bị cho key ${targetKey}! Bạn có thể kích hoạt key trên máy mới ngay bây giờ.`
                : "Đã kích hoạt dịch vụ Reset HWID. Bạn có thể sử dụng mã đơn này để xóa máy cũ trong Cổng Tra Cứu Key."
            }
          });
        }
      }
    }

    await this.commerceRepo.updateOrderStatus(order.id, "fulfilled", { fulfilledAt: isoNow() });
    return this.commerceRepo.getOrderByCode(order.orderCode);
  }

  async addInventoryBatch({ productId, variantId, rawKeys }) {
    if (!Array.isArray(rawKeys) || rawKeys.length === 0) {
      throw new Error("rawKeys must be a non-empty array");
    }

    const insertedIds = [];
    for (const rawKey of rawKeys) {
      const cleanKey = String(rawKey || "").trim();
      if (!cleanKey) continue;

      const encrypted = encryptSecret(cleanKey);
      const id = await this.commerceRepo.addInventoryItem({
        productId,
        variantId,
        encryptedSecret: encrypted.encryptedSecret,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        secretLast4: encrypted.secretLast4
      });
      insertedIds.push(id);
    }
    return { addedCount: insertedIds.length };
  }

  async submitCardTopup({ telco, declaredAmount, serial, pin, customerContact }) {
    if (!telco || !declaredAmount || !serial || !pin) {
      const err = new Error("Vui lòng điền đầy đủ thông tin thẻ cào");
      err.statusCode = 400;
      err.code = "INVALID_CARD_DATA";
      throw err;
    }

    const txCode = `CARD-${Date.now().toString().slice(-6)}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    await this.commerceRepo.createCardTransaction({
      transactionCode: txCode,
      telco: telco.toUpperCase(),
      declaredAmount: Number(declaredAmount),
      serial: String(serial).trim(),
      pin: String(pin).trim(),
      customerContact: customerContact || null
    });

    return {
      transactionCode: txCode,
      telco,
      declaredAmount,
      status: "PENDING",
      message: "Thẻ cào đã được gửi lên hệ thống. Hệ thống đang tiến hành đối soát và xử lý tự động trong 1-3 phút!"
    };
  }

  async getRecentActivity() {
    return this.commerceRepo.listRecentActivity(8);
  }
}
