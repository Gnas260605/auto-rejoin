import { Router } from "express";

export function createWalletRouter({ controller, authMiddleware, rateLimits = {} }) {
  const router = Router();

  const walletLimiter = rateLimits.walletLimiter || ((_req, _res, next) => next());

  router.use(authMiddleware.authenticate);
  router.get("/", walletLimiter, controller.getBalance);
  router.get("/transactions", walletLimiter, controller.getTransactions);

  return router;
}
