import { toSqlDate } from "../utils/time.js";

export class WalletRepository {
  constructor(pool = null) {
    this.pool = pool;
    this.wallets = [];
    this.transactions = [];
    this.nextWalletId = 1;
    this.nextTxId = 1;
  }

  async findByUserId(userId, connection = null) {
    if (!this.pool || typeof this.pool.query !== "function") {
      const w = this.wallets.find((wallet) => String(wallet.userId) === String(userId));
      return w ? { ...w } : null;
    }
    const executor = connection || this.pool;
    const [rows] = await executor.query(
      `SELECT id, user_id AS userId, balance, locked_balance AS lockedBalance,
              currency, version, created_at AS createdAt, updated_at AS updatedAt
       FROM wallets
       WHERE user_id = ?`,
      [userId]
    );
    return rows[0] || null;
  }

  async findById(walletId, connection = null) {
    if (!this.pool || typeof this.pool.query !== "function") {
      const w = this.wallets.find((wallet) => String(wallet.id) === String(walletId));
      return w ? { ...w } : null;
    }
    const executor = connection || this.pool;
    const [rows] = await executor.query(
      `SELECT id, user_id AS userId, balance, locked_balance AS lockedBalance,
              currency, version, created_at AS createdAt, updated_at AS updatedAt
       FROM wallets
       WHERE id = ?`,
      [walletId]
    );
    return rows[0] || null;
  }

  async createWallet(userId, connection = null) {
    const now = toSqlDate();
    if (!this.pool || typeof this.pool.query !== "function") {
      const id = this.nextWalletId++;
      const wallet = {
        id,
        userId: typeof userId === "object" && userId.userId ? userId.userId : userId,
        balance: 0,
        lockedBalance: 0,
        currency: "VND",
        version: 1,
        createdAt: now,
        updatedAt: now
      };
      this.wallets.push(wallet);
      return id;
    }
    const executor = connection || this.pool;
    const targetUserId = typeof userId === "object" && userId.userId ? userId.userId : userId;
    const [result] = await executor.query(
      `INSERT INTO wallets (user_id, balance, locked_balance, currency, version, created_at, updated_at)
       VALUES (?, 0, 0, 'VND', 1, ?, ?)`,
      [targetUserId, now, now]
    );
    return result.insertId;
  }

  async findTransactionByIdempotencyKey(idempotencyKey, connection = null) {
    if (!this.pool || typeof this.pool.query !== "function") {
      const tx = this.transactions.find((t) => t.idempotencyKey === idempotencyKey);
      return tx ? { ...tx } : null;
    }
    const executor = connection || this.pool;
    const [rows] = await executor.query(
      `SELECT id, wallet_id AS walletId, type, direction, amount,
              balance_before AS balanceBefore, balance_after AS balanceAfter,
              reference_type AS referenceType, reference_id AS referenceId,
              idempotency_key AS idempotencyKey, description, actor_id AS actorId,
              metadata_json AS metadata, created_at AS createdAt
       FROM wallet_transactions
       WHERE idempotency_key = ?`,
      [idempotencyKey]
    );
    return rows[0] || null;
  }

  async listTransactionsByWalletId(walletId, { page = 1, limit = 20, type, direction, startDate, endDate } = {}) {
    if (!this.pool || typeof this.pool.query !== "function") {
      let filtered = this.transactions.filter((t) => String(t.walletId) === String(walletId));
      if (type) filtered = filtered.filter((t) => t.type === type);
      if (direction) filtered = filtered.filter((t) => t.direction === direction);
      filtered.sort((a, b) => b.id - a.id);
      const total = filtered.length;
      const offset = (page - 1) * limit;
      const items = filtered.slice(offset, offset + limit);
      return {
        transactions: items,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / limit) || 1
        }
      };
    }

    const conditions = ["wallet_id = ?"];
    const params = [walletId];

    if (type) {
      conditions.push("type = ?");
      params.push(type);
    }
    if (direction) {
      conditions.push("direction = ?");
      params.push(direction);
    }
    if (startDate) {
      conditions.push("created_at >= ?");
      params.push(toSqlDate(startDate));
    }
    if (endDate) {
      conditions.push("created_at <= ?");
      params.push(toSqlDate(endDate));
    }

    const whereClause = conditions.join(" AND ");

    const [countRows] = await this.pool.query(
      `SELECT COUNT(*) AS total FROM wallet_transactions WHERE ${whereClause}`,
      params
    );
    const total = countRows[0]?.total || 0;

    const offset = (page - 1) * limit;
    const [rows] = await this.pool.query(
      `SELECT id, wallet_id AS walletId, type, direction, amount,
              balance_before AS balanceBefore, balance_after AS balanceAfter,
              reference_type AS referenceType, reference_id AS referenceId,
              idempotency_key AS idempotencyKey, description, actor_id AS actorId,
              metadata_json AS metadata, created_at AS createdAt
       FROM wallet_transactions
       WHERE ${whereClause}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      transactions: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  // Atomically execute a wallet balance change and append to immutable ledger
  async executeLedgerTransaction({
    walletId,
    amount,
    direction,
    type,
    referenceType = null,
    referenceId = null,
    idempotencyKey,
    description,
    actorId = null,
    metadata = null
  }) {
    if (!this.pool || typeof this.pool.getConnection !== "function") {
      // In-memory mock mode for unit tests without raw MySQL pool
      return this._executeLedgerMock({
        walletId,
        amount,
        direction,
        type,
        referenceType,
        referenceId,
        idempotencyKey,
        description,
        actorId,
        metadata
      });
    }

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Check idempotency inside transaction
      const [existingRows] = await connection.query(
        `SELECT id, wallet_id AS walletId, type, direction, amount,
                balance_before AS balanceBefore, balance_after AS balanceAfter,
                reference_type AS referenceType, reference_id AS referenceId,
                idempotency_key AS idempotencyKey, description, actor_id AS actorId,
                metadata_json AS metadata, created_at AS createdAt
         FROM wallet_transactions
         WHERE idempotency_key = ? FOR UPDATE`,
        [idempotencyKey]
      );

      if (existingRows.length > 0) {
        const existing = existingRows[0];
        // Verify payload matches
        if (
          existing.walletId === walletId &&
          Number(existing.amount) === Number(amount) &&
          existing.direction === direction &&
          existing.type === type
        ) {
          await connection.commit();
          return {
            transaction: existing,
            isIdempotentReplay: true
          };
        } else {
          await connection.rollback();
          const err = new Error("Idempotency key already used with different payload");
          err.statusCode = 409;
          err.code = "IDEMPOTENCY_CONFLICT";
          throw err;
        }
      }

      // 2. Lock wallet row with SELECT ... FOR UPDATE
      const [walletRows] = await connection.query(
        `SELECT id, user_id AS userId, balance, locked_balance AS lockedBalance, version
         FROM wallets
         WHERE id = ? FOR UPDATE`,
        [walletId]
      );

      if (!walletRows.length) {
        await connection.rollback();
        const err = new Error("Wallet not found");
        err.statusCode = 404;
        err.code = "WALLET_NOT_FOUND";
        throw err;
      }

      const wallet = walletRows[0];
      const balanceBefore = Number(wallet.balance);
      let balanceAfter = balanceBefore;

      if (direction === "CREDIT") {
        balanceAfter = balanceBefore + Number(amount);
      } else if (direction === "DEBIT") {
        if (balanceBefore < Number(amount)) {
          await connection.rollback();
          const err = new Error("Số dư ví không đủ");
          err.statusCode = 400;
          err.code = "INSUFFICIENT_BALANCE";
          err.details = {
            currentBalance: balanceBefore,
            requiredAmount: Number(amount)
          };
          throw err;
        }
        balanceAfter = balanceBefore - Number(amount);
      } else {
        await connection.rollback();
        const err = new Error("Invalid direction");
        err.statusCode = 400;
        throw err;
      }

      const now = toSqlDate();

      // 3. Update wallet balance and increment version
      await connection.query(
        `UPDATE wallets
         SET balance = ?, version = version + 1, updated_at = ?
         WHERE id = ?`,
        [balanceAfter, now, walletId]
      );

      // 4. Insert into immutable wallet_transactions
      const [txResult] = await connection.query(
        `INSERT INTO wallet_transactions
         (wallet_id, type, direction, amount, balance_before, balance_after,
          reference_type, reference_id, idempotency_key, description, actor_id, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          walletId,
          type,
          direction,
          amount,
          balanceBefore,
          balanceAfter,
          referenceType,
          referenceId ? String(referenceId) : null,
          idempotencyKey,
          description,
          actorId,
          metadata ? JSON.stringify(metadata) : null,
          now
        ]
      );

      await connection.commit();

      return {
        transaction: {
          id: txResult.insertId,
          walletId,
          type,
          direction,
          amount,
          balanceBefore,
          balanceAfter,
          referenceType,
          referenceId,
          idempotencyKey,
          description,
          actorId,
          metadata,
          createdAt: now
        },
        wallet: {
          id: walletId,
          userId: wallet.userId,
          balance: balanceAfter,
          lockedBalance: Number(wallet.lockedBalance),
          version: wallet.version + 1
        },
        isIdempotentReplay: false
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async _executeLedgerMock(params) {
    const wallet = this.wallets.find((w) => String(w.id) === String(params.walletId));
    if (!wallet) {
      const err = new Error("Wallet not found");
      err.statusCode = 404;
      err.code = "WALLET_NOT_FOUND";
      throw err;
    }

    const existing = await this.findTransactionByIdempotencyKey(params.idempotencyKey);
    if (existing) {
      if (
        String(existing.walletId) === String(params.walletId) &&
        Number(existing.amount) === Number(params.amount) &&
        existing.direction === params.direction &&
        existing.type === params.type
      ) {
        return { transaction: existing, wallet: { ...wallet }, isIdempotentReplay: true };
      }
      const err = new Error("Idempotency key already used with different payload");
      err.statusCode = 409;
      err.code = "IDEMPOTENCY_CONFLICT";
      throw err;
    }

    const balanceBefore = Number(wallet.balance);
    let balanceAfter = balanceBefore;
    if (params.direction === "CREDIT") {
      balanceAfter = balanceBefore + Number(params.amount);
    } else if (params.direction === "DEBIT") {
      if (balanceBefore < Number(params.amount)) {
        const err = new Error("Số dư ví không đủ");
        err.statusCode = 400;
        err.code = "INSUFFICIENT_BALANCE";
        err.details = { currentBalance: balanceBefore, requiredAmount: Number(params.amount) };
        throw err;
      }
      balanceAfter = balanceBefore - Number(params.amount);
    }

    const now = toSqlDate();
    const createdTx = {
      id: this.nextTxId++,
      walletId: params.walletId,
      type: params.type,
      direction: params.direction,
      amount: Number(params.amount),
      balanceBefore,
      balanceAfter,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      idempotencyKey: params.idempotencyKey,
      description: params.description,
      actorId: params.actorId,
      metadata: params.metadata,
      createdAt: now
    };

    this.transactions.push(createdTx);
    wallet.balance = balanceAfter;
    wallet.version = (wallet.version || 1) + 1;
    wallet.updatedAt = now;

    return {
      transaction: createdTx,
      wallet: { ...wallet },
      isIdempotentReplay: false
    };
  }
}
