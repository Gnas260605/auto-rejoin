import { Router } from "express";

export function createUserAuthRouter({ controller, authMiddleware, rateLimits = {} }) {
  const router = Router();

  const registerLimiter = rateLimits.registerLimiter || ((_req, _res, next) => next());
  const loginLimiter = rateLimits.loginLimiter || ((_req, _res, next) => next());
  const refreshLimiter = rateLimits.refreshLimiter || ((_req, _res, next) => next());

  router.post("/register", registerLimiter, controller.register);
  router.post("/login", loginLimiter, controller.login);
  router.post("/refresh", refreshLimiter, controller.refresh);
  router.post("/logout", controller.logout);
  if (authMiddleware) {
    router.get("/me", authMiddleware.authenticate, controller.me);
  }

  return router;
}
