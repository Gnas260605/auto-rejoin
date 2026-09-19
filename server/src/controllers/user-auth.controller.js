import { registerSchema, loginSchema, refreshSchema, updateProfileSchema, changePasswordSchema } from "../validators/user-auth.validator.js";

export class UserAuthController {
  constructor(userAuthService, config = {}) {
    this.userAuthService = userAuthService;
    this.config = config;
    this.isProd = config.isProduction || process.env.NODE_ENV === "production";
  }

  setAuthCookies(res, { accessToken, refreshToken }) {
    const isHttps = this.isProd;
    const sameSite = this.isProd ? "strict" : "lax";

    if (accessToken) {
      res.cookie("customer_access_token", accessToken, {
        httpOnly: true,
        secure: isHttps,
        sameSite,
        maxAge: 15 * 60 * 1000 // 15m
      });
    }

    if (refreshToken) {
      res.cookie("customer_refresh_token", refreshToken, {
        httpOnly: true,
        secure: isHttps,
        sameSite,
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30d
      });
    }
  }

  clearAuthCookies(res) {
    const isHttps = this.isProd;
    const sameSite = this.isProd ? "strict" : "lax";
    res.clearCookie("customer_access_token", { httpOnly: true, secure: isHttps, sameSite });
    res.clearCookie("customer_refresh_token", { httpOnly: true, secure: isHttps, sameSite });
  }

  register = async (req, res, next) => {
    try {
      const parsed = registerSchema.parse(req.body);
      const result = await this.userAuthService.register(parsed);

      this.setAuthCookies(res, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      });

      res.status(201).json({
        ok: true,
        user: result.user,
        wallet: result.wallet,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        permissions: result.permissions
      });
    } catch (error) {
      next(error);
    }
  };

  login = async (req, res, next) => {
    try {
      const parsed = loginSchema.parse(req.body);
      const ip = req.ip || req.headers["x-forwarded-for"] || null;
      const userAgent = req.headers["user-agent"] || null;

      const result = await this.userAuthService.login({
        ...parsed,
        ip,
        userAgent
      });

      this.setAuthCookies(res, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      });

      res.json({
        ok: true,
        user: result.user,
        wallet: result.wallet,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        permissions: result.permissions
      });
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req, res, next) => {
    try {
      let rawRefreshToken = req.body?.refreshToken;
      if (!rawRefreshToken && req.cookies && req.cookies.customer_refresh_token) {
        rawRefreshToken = req.cookies.customer_refresh_token;
      }

      const parsed = refreshSchema.parse({ refreshToken: rawRefreshToken });
      const ip = req.ip || req.headers["x-forwarded-for"] || null;
      const userAgent = req.headers["user-agent"] || null;

      const result = await this.userAuthService.refresh({
        refreshToken: parsed.refreshToken,
        ip,
        userAgent
      });

      this.setAuthCookies(res, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      });

      res.json({
        ok: true,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
        permissions: result.permissions
      });
    } catch (error) {
      next(error);
    }
  };

  logout = async (req, res, next) => {
    try {
      let rawRefreshToken = req.body?.refreshToken;
      if (!rawRefreshToken && req.cookies && req.cookies.customer_refresh_token) {
        rawRefreshToken = req.cookies.customer_refresh_token;
      }

      await this.userAuthService.logout(rawRefreshToken);
      this.clearAuthCookies(res);

      res.json({
        ok: true,
        message: "Đăng xuất thành công"
      });
    } catch (error) {
      next(error);
    }
  };

  getMe = async (req, res, next) => {
    try {
      const user = await this.userAuthService.getMe(req.user.id);
      res.json({
        ok: true,
        user,
        wallet: user.wallet
      });
    } catch (error) {
      next(error);
    }
  };

  me = (req, res, next) => this.getMe(req, res, next);
}
