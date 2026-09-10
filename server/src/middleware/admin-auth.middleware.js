import { verifyAdminToken } from "../utils/admin-auth.js";
import { ADMIN_COOKIE_NAME, ADMIN_STATUSES } from "../constants/admin.js";

export function createAdminAuthMiddleware({ adminRepository, config }) {
  return async function adminAuthMiddleware(req, res, next) {
    try {
      let token = req.cookies?.[ADMIN_COOKIE_NAME];
      if (!token && req.headers.authorization) {
        const parts = req.headers.authorization.split(" ");
        if (parts.length === 2 && /^bearer$/i.test(parts[0])) {
          token = parts[1];
        }
      }

      if (!token) {
        return res.status(401).json({
          ok: false,
          code: "UNAUTHORIZED",
          message: "Admin authentication required"
        });
      }

      const payload = verifyAdminToken(token, config.admin.jwtSecret);
      if (!payload || !payload.sub) {
        return res.status(401).json({
          ok: false,
          code: "INVALID_TOKEN",
          message: "Invalid or expired admin session"
        });
      }

      const adminId = Number(payload.sub);

      if (adminRepository) {
        const adminUser = await adminRepository.findAdminById(adminId);
        if (!adminUser) {
          return res.status(401).json({
            ok: false,
            code: "ADMIN_NOT_FOUND",
            message: "Admin account does not exist"
          });
        }
        if (adminUser.status === ADMIN_STATUSES.DISABLED) {
          return res.status(403).json({
            ok: false,
            code: "ADMIN_DISABLED",
            message: "Admin account is disabled"
          });
        }
        req.admin = {
          id: adminUser.id,
          username: adminUser.username,
          role: adminUser.role
        };
      } else {
        req.admin = {
          id: adminId,
          username: payload.username,
          role: payload.role || "admin"
        };
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
