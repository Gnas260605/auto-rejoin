export class WalletService {
  constructor({ walletRepository, userRepository }) {
    this.walletRepo = walletRepository;
    this.userRepo = userRepository;
  }

  async getOrCreateWallet(userId) {
    let wallet = await this.walletRepo.findByUserId(userId);
    if (!wallet) {
      const walletId = await this.walletRepo.createWallet(userId);
      wallet = await this.walletRepo.findById(walletId);
    }
    return wallet;
  }

  async getBalance(userId) {
    const wallet = await this.getOrCreateWallet(userId);
    return {
      walletId: wallet.id,
      userId: wallet.userId,
      balance: Number(wallet.balance),
      lockedBalance: Number(wallet.lockedBalance),
      availableBalance: Number(wallet.balance) - Number(wallet.lockedBalance),
      currency: wallet.currency,
      version: wallet.version
    };
  }

  async getTransactions(userId, { page = 1, limit = 20, type, direction, startDate, endDate } = {}) {
    const wallet = await this.getOrCreateWallet(userId);
    return this.walletRepo.listTransactionsByWalletId(wallet.id, {
      page,
      limit,
      type,
      direction,
      startDate,
      endDate
    });
  }

  async credit({
    userId,
    amount,
    type = "TOPUP",
    referenceType = null,
    referenceId = null,
    idempotencyKey,
    description,
    actorId = null,
    metadata = null
  }) {
    if (!Number.isInteger(amount) || amount <= 0) {
      const err = new Error("Số tiền nạp/cộng phải là số nguyên dương");
      err.statusCode = 400;
      err.code = "INVALID_AMOUNT";
      throw err;
    }
    if (!idempotencyKey || typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
      const err = new Error("Idempotency key là bắt buộc");
      err.statusCode = 400;
      err.code = "MISSING_IDEMPOTENCY_KEY";
      throw err;
    }

    const wallet = await this.getOrCreateWallet(userId);

    const result = await this.walletRepo.executeLedgerTransaction({
      walletId: wallet.id,
      amount,
      direction: "CREDIT",
      type,
      referenceType,
      referenceId,
      idempotencyKey: idempotencyKey.trim(),
      description: description || `Cộng ${amount.toLocaleString("vi-VN")} VND vào ví`,
      actorId: actorId || userId,
      metadata
    });

    const currentWallet = await this.walletRepo.findById(wallet.id);
    const balance = currentWallet ? Number(currentWallet.balance) : (result.wallet ? Number(result.wallet.balance) : Number(result.transaction.balanceAfter));

    return {
      ...result,
      balance,
      isDuplicate: !!result.isIdempotentReplay
    };
  }

  async debit({
    userId,
    amount,
    type = "PURCHASE",
    referenceType = null,
    referenceId = null,
    idempotencyKey,
    description,
    actorId = null,
    metadata = null
  }) {
    if (!Number.isInteger(amount) || amount <= 0) {
      const err = new Error("Số tiền thanh toán phải là số nguyên dương");
      err.statusCode = 400;
      err.code = "INVALID_AMOUNT";
      throw err;
    }
    if (!idempotencyKey || typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
      const err = new Error("Idempotency key là bắt buộc");
      err.statusCode = 400;
      err.code = "MISSING_IDEMPOTENCY_KEY";
      throw err;
    }

    const wallet = await this.getOrCreateWallet(userId);

    const result = await this.walletRepo.executeLedgerTransaction({
      walletId: wallet.id,
      amount,
      direction: "DEBIT",
      type,
      referenceType,
      referenceId,
      idempotencyKey: idempotencyKey.trim(),
      description: description || `Thanh toán ${amount.toLocaleString("vi-VN")} VND từ ví`,
      actorId: actorId || userId,
      metadata
    });

    const currentWallet = await this.walletRepo.findById(wallet.id);
    const balance = currentWallet ? Number(currentWallet.balance) : (result.wallet ? Number(result.wallet.balance) : Number(result.transaction.balanceAfter));

    return {
      ...result,
      balance,
      isDuplicate: !!result.isIdempotentReplay
    };
  }

  async refund({
    userId,
    amount,
    referenceType = "ORDER",
    referenceId,
    idempotencyKey,
    description,
    actorId = null,
    metadata = null
  }) {
    return this.credit({
      userId,
      amount,
      type: "REFUND",
      referenceType,
      referenceId,
      idempotencyKey,
      description: description || `Hoàn tiền ${amount.toLocaleString("vi-VN")} VND vào ví`,
      actorId,
      metadata
    });
  }
}
