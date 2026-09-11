import { mysqlDate, nowDate } from "../utils/time.js";

export class PaymentRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async withTransaction(work) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const transactionalRepo = new PaymentRepository(connection);
      const result = await work(transactionalRepo);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async createPayment(fields) {
    const now = mysqlDate(nowDate());
    const expiredAt = mysqlDate(fields.expiredAt);
    const [result] = await this.pool.execute(
      `INSERT INTO payments 
        (payment_code, user_id, plan_id, plan_name, expected_amount, paid_amount, status, provider,
         transfer_content, payment_secret_token, created_at, expired_at)
       VALUES (?, ?, ?, ?, ?, 0, 'pending', ?, ?, ?, ?, ?)`,
      [
        fields.paymentCode,
        fields.userId || null,
        fields.planId,
        fields.planName,
        fields.expectedAmount,
        fields.provider || "vietqr",
        fields.transferContent,
        fields.paymentSecretToken,
        now,
        expiredAt
      ]
    );
    return result.insertId;
  }

  async findPaymentByCode(paymentCode) {
    const [rows] = await this.pool.execute(
      "SELECT * FROM payments WHERE payment_code = ?",
      [paymentCode]
    );
    return rows[0] || null;
  }

  async findPaymentByCodeForUpdate(paymentCode) {
    const [rows] = await this.pool.execute(
      "SELECT * FROM payments WHERE payment_code = ? FOR UPDATE",
      [paymentCode]
    );
    return rows[0] || null;
  }

  async findPaymentByIdForUpdate(id) {
    const [rows] = await this.pool.execute(
      "SELECT * FROM payments WHERE id = ? FOR UPDATE",
      [id]
    );
    return rows[0] || null;
  }

  async findPaymentByTransferContent(transferContent) {
    const [rows] = await this.pool.execute(
      "SELECT * FROM payments WHERE transfer_content = ?",
      [transferContent]
    );
    return rows[0] || null;
  }

  async findPaymentByTransferContentForUpdate(transferContent) {
    const [rows] = await this.pool.execute(
      "SELECT * FROM payments WHERE transfer_content = ? FOR UPDATE",
      [transferContent]
    );
    return rows[0] || null;
  }

  async findPaymentByProviderTxId(providerTxId) {
    const [rows] = await this.pool.execute(
      "SELECT * FROM payments WHERE provider_transaction_id = ?",
      [providerTxId]
    );
    return rows[0] || null;
  }

  async markPaymentPaid(id, fields) {
    const now = mysqlDate(nowDate());
    await this.pool.execute(
      `UPDATE payments 
       SET status = 'paid',
           paid_amount = ?,
           provider_transaction_id = ?,
           license_id = ?,
           issued_raw_key = ?,
           paid_at = ?
       WHERE id = ?`,
      [
        fields.paidAmount,
        fields.providerTransactionId || null,
        fields.licenseId,
        fields.issuedRawKey || null,
        now,
        id
      ]
    );
  }

  async markPaymentExpired(id) {
    await this.pool.execute(
      "UPDATE payments SET status = 'expired' WHERE id = ? AND status = 'pending'",
      [id]
    );
  }

  async markPaymentFailed(id) {
    await this.pool.execute(
      "UPDATE payments SET status = 'failed' WHERE id = ? AND status = 'pending'",
      [id]
    );
  }

  async listPayments({ page = 1, limit = 20, status, search }) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;

    const whereClauses = [];
    const params = [];

    if (status) {
      whereClauses.push("status = ?");
      params.push(status);
    }

    if (search) {
      whereClauses.push("(payment_code LIKE ? OR transfer_content LIKE ? OR user_id LIKE ?)");
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const [countRows] = await this.pool.execute(
      `SELECT COUNT(*) AS total FROM payments ${whereSql}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await this.pool.execute(
      `SELECT id, payment_code, user_id, plan_id, plan_name, expected_amount, paid_amount,
              status, provider, provider_transaction_id, transfer_content, license_id,
              created_at, paid_at, expired_at
       FROM payments
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT ${Number(safeLimit)} OFFSET ${Number(offset)}`,
      params
    );

    return {
      items: rows,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1
    };
  }

  async cancelPaymentByCode(paymentCode) {
    const [result] = await this.pool.execute(
      "UPDATE payments SET status = 'cancelled' WHERE payment_code = ? AND status IN ('pending', 'expired')",
      [paymentCode]
    );
    return result.affectedRows > 0;
  }

  async cancelPaymentById(id) {
    const [result] = await this.pool.execute(
      "UPDATE payments SET status = 'cancelled' WHERE id = ? AND status IN ('pending', 'expired')",
      [id]
    );
    return result.affectedRows > 0;
  }

  async deletePaymentById(id) {
    const [result] = await this.pool.execute(
      "DELETE FROM payments WHERE id = ? AND (status != 'paid' OR license_id IS NULL)",
      [id]
    );
    return result.affectedRows > 0;
  }

  async cleanupIncompletePayments() {
    const [result] = await this.pool.execute(
      "DELETE FROM payments WHERE status IN ('pending', 'expired', 'cancelled', 'failed') AND license_id IS NULL"
    );
    return result.affectedRows || 0;
  }

  async getRevenueStats() {
    const [totalRevenueRows] = await this.pool.execute(
      "SELECT COALESCE(SUM(paid_amount), 0) AS total_revenue, COUNT(*) AS total_paid FROM payments WHERE status = 'paid'"
    );
    const [pendingRows] = await this.pool.execute(
      "SELECT COUNT(*) AS total_pending FROM payments WHERE status = 'pending'"
    );
    const [cancelledRows] = await this.pool.execute(
      "SELECT COUNT(*) AS total_cancelled FROM payments WHERE status IN ('cancelled', 'expired', 'failed')"
    );
    return {
      totalRevenue: Number(totalRevenueRows[0]?.total_revenue || 0),
      totalPaidOrders: Number(totalRevenueRows[0]?.total_paid || 0),
      totalPendingOrders: Number(pendingRows[0]?.total_pending || 0),
      totalCancelledOrders: Number(cancelledRows[0]?.total_cancelled || 0)
    };
  }
}
