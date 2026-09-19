import crypto from "node:crypto";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { getPool } from "./db/pool.js";
import { LicenseRepository } from "./repositories/license.repository.js";
import { LicenseService } from "./services/license.service.js";
import { LicenseController } from "./controllers/license.controller.js";
import { createLicenseRouter } from "./routes/license.routes.js";
import { createRateLimits } from "./middleware/rate-limit.middleware.js";
import { AdminRepository } from "./repositories/admin.repository.js";
import { AdminService } from "./services/admin.service.js";
import { AdminController } from "./controllers/admin.controller.js";
import { createAdminRouter } from "./routes/admin.routes.js";
import { createAdminAuthMiddleware } from "./middleware/admin-auth.middleware.js";
import { createAdminRateLimits } from "./middleware/admin-rate-limit.middleware.js";
import { PaymentRepository } from "./repositories/payment.repository.js";
import { PaymentService } from "./services/payment.service.js";
import { PaymentController } from "./controllers/payment.controller.js";
import { createPaymentRouter } from "./routes/payment.routes.js";
import { CommerceRepository } from "./repositories/commerce.repository.js";
import { CommerceService } from "./services/commerce.service.js";
import { CommerceController } from "./controllers/commerce.controller.js";
import { createCommerceRouter, createCommerceAdminRouter } from "./routes/commerce.routes.js";
import { UserRepository } from "./repositories/user.repository.js";
import { WalletRepository } from "./repositories/wallet.repository.js";
import { RbacRepository } from "./repositories/rbac.repository.js";
import { RbacService } from "./services/rbac.service.js";
import { UserAuthService } from "./services/user-auth.service.js";
import { WalletService } from "./services/wallet.service.js";
import { UserAuthController } from "./controllers/user-auth.controller.js";
import { WalletController } from "./controllers/wallet.controller.js";
import { createCustomerAuthMiddleware } from "./middleware/customer-auth.middleware.js";
import { createCustomerRateLimits } from "./middleware/customer-rate-limit.middleware.js";
import { createUserAuthRouter } from "./routes/user-auth.routes.js";
import { createWalletRouter } from "./routes/wallet.routes.js";
import { errorMiddleware, notFoundMiddleware } from "./middleware/error.middleware.js";
import { isoNow } from "./utils/time.js";

export function createApp({
  repository,
  adminRepository,
  paymentRepository,
  commerceRepository,
  userRepository,
  walletRepository,
  rbacRepository,
  config = env
} = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());

  const allowedOrigins = config.admin?.origins || [];
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
          callback(null, true);
        } else {
          callback(new Error(`Origin ${origin} not allowed by CORS`));
        }
      },
      credentials: true
    })
  );

  app.use(cookieParser());
  app.use(express.json({ limit: "16kb" }));
  app.use((req, _res, next) => {
    req.id = crypto.randomUUID();
    next();
  });

  const pool = (!repository || !adminRepository || !paymentRepository || !commerceRepository || !userRepository || !walletRepository || !rbacRepository) ? getPool() : null;
  const licRepo = repository || new LicenseRepository(pool);
  const admRepo = adminRepository || new AdminRepository(pool);
  const payRepo = paymentRepository || new PaymentRepository(pool);
  const comRepo = commerceRepository || new CommerceRepository(pool);
  const userRepo = userRepository || new UserRepository(pool);
  const walRepo = walletRepository || new WalletRepository(pool);
  const rbacRepo = rbacRepository || new RbacRepository(pool);

  const licService = new LicenseService({ repository: licRepo, config });
  const licController = new LicenseController(licService);
  const licRateLimits = createRateLimits(config);

  const admService = new AdminService({ adminRepository: admRepo, licenseRepository: licRepo, config });
  const admController = new AdminController(admService, config);
  const admAuthMiddleware = createAdminAuthMiddleware({ adminRepository: admRepo, config });
  const admRateLimits = createAdminRateLimits(config);

  const payService = new PaymentService({
    paymentRepository: payRepo,
    licenseRepository: licRepo,
    adminRepository: admRepo,
    config
  });
  const payController = new PaymentController(payService);

  const comService = new CommerceService({
    commerceRepository: comRepo,
    licenseRepository: licRepo,
    paymentRepository: payRepo,
    config
  });
  const comController = new CommerceController(comService);

  const rbacService = new RbacService({ rbacRepository: rbacRepo });
  const userAuthService = new UserAuthService({
    userRepository: userRepo,
    walletRepository: walRepo,
    rbacService,
    config
  });
  const userAuthController = new UserAuthController(userAuthService, config);

  const walletService = new WalletService({
    walletRepository: walRepo,
    config
  });
  const walletController = new WalletController(walletService);

  const customerAuthMiddleware = createCustomerAuthMiddleware({
    userAuthService,
    rbacService
  });
  const customerRateLimits = createCustomerRateLimits(config);

  app.get("/api/v1/health", async (_req, res, next) => {
    try {
      if (!repository) {
        await getPool().query("SELECT 1");
      }
      res.json({ ok: true, time: isoNow() });
    } catch (error) {
      next(error);
    }
  });

  // Customer Authentication & Profile
  app.use("/api/v1/auth", createUserAuthRouter({
    controller: userAuthController,
    authMiddleware: customerAuthMiddleware,
    rateLimits: customerRateLimits
  }));
  app.get("/api/v1/me", customerAuthMiddleware.authenticate, userAuthController.me);

  // Customer Wallet
  app.use("/api/v1/wallet", createWalletRouter({
    controller: walletController,
    authMiddleware: customerAuthMiddleware,
    rateLimits: customerRateLimits
  }));

  // Existing Core APIs
  app.use("/api/v1", createLicenseRouter({ controller: licController, rateLimits: licRateLimits }));
  app.use("/api/v1", createPaymentRouter({ controller: payController, rateLimits: licRateLimits }));
  app.use("/api/v1", createCommerceRouter({ controller: comController, rateLimits: licRateLimits }));
  app.use(
    "/api/v1/admin",
    createAdminRouter({
      controller: admController,
      paymentController: payController,
      authMiddleware: admAuthMiddleware,
      rateLimits: admRateLimits
    })
  );
  app.use(
    "/api/v1/admin/commerce",
    createCommerceAdminRouter({
      controller: comController,
      authMiddleware: admAuthMiddleware,
      rateLimits: admRateLimits
    })
  );

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
