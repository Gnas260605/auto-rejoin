import { z } from "zod";

export const walletTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(["TOPUP", "PURCHASE", "REFUND", "ADJUSTMENT", "REWARD"]).optional(),
  direction: z.enum(["CREDIT", "DEBIT"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional()
});

export const internalCreditDebitSchema = z.object({
  amount: z.number().int().positive("Số tiền phải lớn hơn 0"),
  type: z.enum(["TOPUP", "PURCHASE", "REFUND", "ADJUSTMENT", "REWARD"]),
  idempotencyKey: z.string().min(8).max(128),
  description: z.string().min(1).max(255),
  referenceType: z.string().max(64).optional(),
  referenceId: z.string().max(64).optional(),
  actorId: z.number().int().optional(),
  metadata: z.record(z.any()).optional()
});
