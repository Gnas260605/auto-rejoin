import test from "node:test";
import assert from "node:assert/strict";
import { WalletRepository } from "../src/repositories/wallet.repository.js";
import { WalletService } from "../src/services/wallet.service.js";

test("WalletService: credit increases balance and creates immutable ledger entry", async () => {
  const walletRepo = new WalletRepository(null);
  const walletService = new WalletService({ walletRepository: walletRepo });

  const userId = "user-test-01";
  const wallet = await walletRepo.createWallet({ userId, currency: "VND" });

  const result = await walletService.credit({
    userId,
    amount: 100000,
    type: "TOPUP",
    idempotencyKey: "topup-001",
    description: "Nạp tiền qua thẻ cào 100k"
  });

  assert.equal(result.isDuplicate, false);
  assert.equal(result.balance, 100000);
  assert.equal(result.transaction.amount, 100000);
  assert.equal(result.transaction.direction, "CREDIT");
  assert.equal(result.transaction.type, "TOPUP");
  assert.equal(result.transaction.balanceBefore, 0);
  assert.equal(result.transaction.balanceAfter, 100000);

  const currentWallet = await walletService.getBalance(userId);
  assert.equal(currentWallet.balance, 100000);
});

test("WalletService: debit decreases balance when sufficient", async () => {
  const walletRepo = new WalletRepository(null);
  const walletService = new WalletService({ walletRepository: walletRepo });

  const userId = "user-test-02";
  await walletRepo.createWallet({ userId, currency: "VND" });

  // Credit 150k
  await walletService.credit({
    userId,
    amount: 150000,
    type: "TOPUP",
    idempotencyKey: "topup-002",
    description: "Initial deposit"
  });

  // Debit 50k
  const debitRes = await walletService.debit({
    userId,
    amount: 50000,
    type: "PURCHASE",
    idempotencyKey: "purchase-001",
    description: "Mua key Auto Rejoin 30 ngày"
  });

  assert.equal(debitRes.balance, 100000);
  assert.equal(debitRes.transaction.amount, 50000);
  assert.equal(debitRes.transaction.direction, "DEBIT");
  assert.equal(debitRes.transaction.balanceBefore, 150000);
  assert.equal(debitRes.transaction.balanceAfter, 100000);
});

test("WalletService: debit fails with INSUFFICIENT_BALANCE if balance is too low", async () => {
  const walletRepo = new WalletRepository(null);
  const walletService = new WalletService({ walletRepository: walletRepo });

  const userId = "user-test-03";
  await walletRepo.createWallet({ userId, currency: "VND" });

  await walletService.credit({
    userId,
    amount: 20000,
    type: "TOPUP",
    idempotencyKey: "topup-003",
    description: "Small deposit"
  });

  await assert.rejects(
    async () => {
      await walletService.debit({
        userId,
        amount: 50000,
        type: "PURCHASE",
        idempotencyKey: "purchase-002",
        description: "Attempt to buy expensive item"
      });
    },
    (err) => err.code === "INSUFFICIENT_BALANCE"
  );

  // Balance remains untouched
  const wallet = await walletService.getBalance(userId);
  assert.equal(wallet.balance, 20000);
});

test("WalletService: idempotency prevents double spending / duplicate credits", async () => {
  const walletRepo = new WalletRepository(null);
  const walletService = new WalletService({ walletRepository: walletRepo });

  const userId = "user-test-04";
  await walletRepo.createWallet({ userId, currency: "VND" });

  const idempotencyKey = "unique-order-key-999";

  // First call
  const firstCall = await walletService.credit({
    userId,
    amount: 50000,
    type: "TOPUP",
    idempotencyKey,
    description: "Payment callback 999"
  });
  assert.equal(firstCall.isDuplicate, false);
  assert.equal(firstCall.balance, 50000);

  // Second duplicate call with same idempotency key and same payload
  const secondCall = await walletService.credit({
    userId,
    amount: 50000,
    type: "TOPUP",
    idempotencyKey,
    description: "Payment callback 999"
  });
  assert.equal(secondCall.isDuplicate, true);
  assert.equal(secondCall.balance, 50000); // Balance NOT doubled!

  // Check ledger count: must be exactly 1 entry
  const { transactions } = await walletService.getTransactions(userId);
  assert.equal(transactions.length, 1);
});

test("WalletService: idempotency conflict on payload mismatch", async () => {
  const walletRepo = new WalletRepository(null);
  const walletService = new WalletService({ walletRepository: walletRepo });

  const userId = "user-test-05";
  await walletRepo.createWallet({ userId, currency: "VND" });

  const idempotencyKey = "conflict-key-100";

  await walletService.credit({
    userId,
    amount: 50000,
    type: "TOPUP",
    idempotencyKey,
    description: "Original payload"
  });

  // Replaying with different amount must throw conflict
  await assert.rejects(
    async () => {
      await walletService.credit({
        userId,
        amount: 100000,
        type: "TOPUP",
        idempotencyKey,
        description: "Modified amount payload"
      });
    },
    (err) => err.code === "IDEMPOTENCY_CONFLICT"
  );
});

test("WalletService: invalid / floating point / negative amounts rejected", async () => {
  const walletRepo = new WalletRepository(null);
  const walletService = new WalletService({ walletRepository: walletRepo });

  const userId = "user-test-06";
  await walletRepo.createWallet({ userId, currency: "VND" });

  await assert.rejects(
    async () => {
      await walletService.credit({
        userId,
        amount: -5000,
        type: "TOPUP",
        idempotencyKey: "neg-1"
      });
    },
    (err) => err.code === "INVALID_AMOUNT"
  );

  await assert.rejects(
    async () => {
      await walletService.credit({
        userId,
        amount: 12.345,
        type: "TOPUP",
        idempotencyKey: "float-1"
      });
    },
    (err) => err.code === "INVALID_AMOUNT"
  );
});
