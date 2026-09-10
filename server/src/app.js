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
import { errorMiddleware, notFoundMiddleware } from "./middleware/error.middleware.js";
import { isoNow } from "./utils/time.js";

export function createApp({ repository, adminRepository, config = env } = {}) {
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

  const pool = (!repository || !adminRepository) ? getPool() : null;
  const licRepo = repository || new LicenseRepository(pool);
  const admRepo = adminRepository || new AdminRepository(pool);

  const licService = new LicenseService({ repository: licRepo, config });
  const licController = new LicenseController(licService);
  const licRateLimits = createRateLimits(config);

  const admService = new AdminService({ adminRepository: admRepo, licenseRepository: licRepo, config });
  const admController = new AdminController(admService, config);
  const admAuthMiddleware = createAdminAuthMiddleware({ adminRepository: admRepo, config });
  const admRateLimits = createAdminRateLimits(config);

  app.get("/api/v1/health", async (_req, res, next) => {
    try {
      if (!repository) {
        await getPool().query("SELECT 1");
      }
      res.json({ ok: true, database: "ok", time: isoNow() });
    } catch (error) {
      next(error);
    }
  });

  app.use("/api/v1", createLicenseRouter({ controller: licController, rateLimits: licRateLimits }));
  app.use(
    "/api/v1/admin",
    createAdminRouter({
      controller: admController,
      authMiddleware: admAuthMiddleware,
      rateLimits: admRateLimits
    })
  );

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
