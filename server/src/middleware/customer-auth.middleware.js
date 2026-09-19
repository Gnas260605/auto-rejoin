export function createCustomerAuthMiddleware({ userAuthService, rbacService }) {
  const authenticate = async (req, res, next) => {
    try {
      let token = null;

      // Check Authorization header first: "Bearer <token>"
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.slice(7).trim();
      }

      // Check Cookie: "customer_access_token"
      if (!token && req.cookies && req.cookies.customer_access_token) {
        token = req.cookies.customer_access_token;
      }

      if (!token) {
        const err = new Error("Chưa đăng nhập hoặc phiên làm việc đã hết hạn");
        err.statusCode = 401;
        err.code = "UNAUTHORIZED";
        return next(err);
      }

      const decoded = userAuthService.verifyAccessToken(token);
      if (!decoded || !decoded.sub) {
        const err = new Error("Token không hợp lệ");
        err.statusCode = 401;
        err.code = "INVALID_TOKEN";
        return next(err);
      }

      req.user = {
        id: Number(decoded.sub),
        email: decoded.email,
        role: decoded.role,
        displayName: decoded.displayName,
        permissions: decoded.permissions || []
      };

      next();
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        const err = new Error("Phiên làm việc đã hết hạn");
        err.statusCode = 401;
        err.code = "TOKEN_EXPIRED";
        return next(err);
      }
      const err = new Error("Xác thực không hợp lệ");
      err.statusCode = 401;
      err.code = "INVALID_TOKEN";
      return next(err);
    }
  };

  const requireRole = (allowedRoles) => {
    const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    return (req, res, next) => {
      if (!req.user) {
        const err = new Error("Chưa xác thực");
        err.statusCode = 401;
        err.code = "UNAUTHORIZED";
        return next(err);
      }

      if (req.user.role === "SUPER_ADMIN" || rolesArray.includes(req.user.role)) {
        return next();
      }

      const err = new Error("Bạn không có quyền thực hiện hành động này");
      err.statusCode = 403;
      err.code = "FORBIDDEN";
      return next(err);
    };
  };

  const requirePermission = (requiredPermission) => {
    return async (req, res, next) => {
      if (!req.user) {
        const err = new Error("Chưa xác thực");
        err.statusCode = 401;
        err.code = "UNAUTHORIZED";
        return next(err);
      }

      if (req.user.role === "SUPER_ADMIN") {
        return next();
      }

      const hasPerm = rbacService
        ? await rbacService.hasPermission(req.user.role, requiredPermission)
        : (req.user.permissions || []).includes(requiredPermission);

      if (hasPerm) {
        return next();
      }

      const err = new Error(`Thiếu quyền truy cập: ${requiredPermission}`);
      err.statusCode = 403;
      err.code = "INSUFFICIENT_PERMISSIONS";
      return next(err);
    };
  };

  return {
    authenticate,
    requireRole,
    requirePermission
  };
}
