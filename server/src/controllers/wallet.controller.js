import { walletTransactionsQuerySchema } from "../validators/wallet.validator.js";

export class WalletController {
  constructor(walletService) {
    this.walletService = walletService;
  }

  getBalance = async (req, res, next) => {
    try {
      const wallet = await this.walletService.getBalance(req.user.id);
      res.json({
        ok: true,
        wallet,
        data: wallet
      });
    } catch (error) {
      next(error);
    }
  };

  getTransactions = async (req, res, next) => {
    try {
      const query = walletTransactionsQuerySchema.parse(req.query);
      const result = await this.walletService.getTransactions(req.user.id, query);
      res.json({
        ok: true,
        transactions: result.transactions,
        data: result.transactions,
        pagination: result.pagination
      });
    } catch (error) {
      next(error);
    }
  };
}
