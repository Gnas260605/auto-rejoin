import { PaymentServiceError } from "../services/payment.service.js";

export class PaymentController {
  constructor(paymentService) {
    this.service = paymentService;
  }

  createOrder = async (req, res, next) => {
    try {
      const { planId, userId } = req.body || {};
      const result = await this.service.createPaymentOrder({ planId, userId });
      res.status(201).json({ ok: true, ...result });
    } catch (error) {
      if (error instanceof PaymentServiceError) {
        return res.status(error.httpStatus).json({ ok: false, code: error.code, message: error.message });
      }
      next(error);
    }
  };

  getStatus = async (req, res, next) => {
    try {
      const { paymentCode } = req.params;
      const result = await this.service.getPaymentStatus(paymentCode);
      res.json(result);
    } catch (error) {
      if (error instanceof PaymentServiceError) {
        return res.status(error.httpStatus).json({ ok: false, code: error.code, message: error.message });
      }
      next(error);
    }
  };

  handleWebhook = async (req, res, next) => {
    try {
      // Support multiple webhook payload formats (SeAPay, Casso, PayOS, standard webhook format)
      const body = req.body || {};
      
      let transferContent = "";
      let amount = 0;
      let providerTxId = "";
      let provider = "webhook";

      if (body.transferContent || body.content || body.description || body.addInfo || body.memo) {
        transferContent = body.transferContent || body.content || body.description || body.addInfo || body.memo;
      }
      if (body.amount || body.transferAmount || body.creditAmount) {
        amount = Number(body.amount || body.transferAmount || body.creditAmount);
      }
      if (body.transactionId || body.id || body.reference || body.providerTxId) {
        providerTxId = String(body.transactionId || body.id || body.reference || body.providerTxId);
      }
      if (body.provider) {
        provider = body.provider;
      }

      // If array payload (e.g. Casso transaction list)
      if (Array.isArray(body.data)) {
        const results = [];
        for (const item of body.data) {
          const itemContent = item.description || item.content || item.memo || "";
          const itemAmount = Number(item.amount || 0);
          const itemTxId = String(item.id || item.transactionId || "");
          const r = await this.service.processWebhookPayment({
            transferContent: itemContent,
            amount: itemAmount,
            providerTxId: itemTxId,
            provider: "casso",
            rawPayload: item
          });
          results.push(r);
        }
        return res.json({ ok: true, processed: results.length, results });
      }

      const result = await this.service.processWebhookPayment({
        transferContent,
        amount,
        providerTxId,
        provider,
        rawPayload: body
      });

      res.json({ ok: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  cancelOrder = async (req, res, next) => {
    try {
      const { paymentCode } = req.params;
      const result = await this.service.cancelPaymentOrder(paymentCode, {
        reason: req.body?.reason || "user_cancelled",
        adminContext: req.admin ? { adminId: req.admin.id, ip: req.ip } : null
      });
      res.json(result);
    } catch (error) {
      if (error instanceof PaymentServiceError) {
        return res.status(error.httpStatus).json({ ok: false, code: error.code, message: error.message });
      }
      next(error);
    }
  };

  deletePayment = async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await this.service.deletePayment(id, {
        adminId: req.admin?.id,
        ip: req.ip
      });
      res.json(result);
    } catch (error) {
      if (error instanceof PaymentServiceError) {
        return res.status(error.httpStatus).json({ ok: false, code: error.code, message: error.message });
      }
      next(error);
    }
  };

  cleanupIncomplete = async (req, res, next) => {
    try {
      const result = await this.service.cleanupIncompleteOrders({
        adminId: req.admin?.id,
        ip: req.ip
      });
      res.json(result);
    } catch (error) {
      if (error instanceof PaymentServiceError) {
        return res.status(error.httpStatus).json({ ok: false, code: error.code, message: error.message });
      }
      next(error);
    }
  };

  getPayOSConfig = async (_req, res, next) => {
    try {
      const config = await this.service.getPayOSConfig();
      res.json({ ok: true, config });
    } catch (error) {
      next(error);
    }
  };

  savePayOSConfig = async (req, res, next) => {
    try {
      const result = await this.service.savePayOSConfig(req.body, {
        adminId: req.admin?.id,
        ip: req.ip
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  testPayOSConnection = async (req, res, next) => {
    try {
      const result = await this.service.testPayOS(req.body);
      res.json(result);
    } catch (error) {
      if (error instanceof PaymentServiceError) {
        return res.status(error.httpStatus).json({ ok: false, code: error.code, message: error.message });
      }
      next(error);
    }
  };

  handlePayOSWebhook = async (req, res, next) => {
    try {
      const body = req.body || {};
      const data = body.data || body;
      
      const transferContent = data.description || data.content || body.description || "";
      const amount = Number(data.amount || body.amount || 0);
      const providerTxId = String(data.reference || data.orderCode || data.paymentLinkId || body.transactionId || `PAYOS-${Date.now()}`);

      const result = await this.service.processWebhookPayment({
        transferContent,
        amount,
        providerTxId,
        provider: "payos",
        rawPayload: body
      });

      // PayOS expects standard response
      res.json({ error: 0, message: "Webhook processed successfully", data: result });
    } catch (error) {
      next(error);
    }
  };

  listPayments = async (req, res, next) => {
    try {
      const result = await this.service.listPayments(req.query);
      res.json({ ok: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  manualVerify = async (req, res, next) => {
    try {
      const { paymentIdOrCode } = req.params;
      const result = await this.service.manualVerifyPayment(paymentIdOrCode, {
        adminId: req.admin?.id,
        ip: req.ip
      });
      res.json(result);
    } catch (error) {
      if (error instanceof PaymentServiceError) {
        return res.status(error.httpStatus).json({ ok: false, code: error.code, message: error.message });
      }
      next(error);
    }
  };

  getRevenueStats = async (_req, res, next) => {
    try {
      const stats = await this.service.getRevenueStats();
      res.json({ ok: true, stats });
    } catch (error) {
      next(error);
    }
  };
}
