import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().trim().email("Email không hợp lệ").max(128),
  username: z.string().trim().min(3, "Tên đăng nhập phải từ 3 ký tự trở lên").max(32).regex(/^[a-zA-Z0-9_-]+$/, "Tên đăng nhập chỉ gồm chữ, số, gạch dưới hoặc gạch ngang").optional(),
  phone: z.string().trim().regex(/^(0|\+84)[0-9]{9,10}$/, "Số điện thoại không hợp lệ").optional().nullable(),
  password: z.string().min(6, "Mật khẩu phải từ 6 ký tự trở lên").max(128),
  fullName: z.string().trim().min(2).max(128).optional(),
  displayName: z.string().trim().min(2).max(128).optional()
});

export const loginSchema = z.object({
  login: z.string().trim().min(1, "Vui lòng nhập tài khoản hoặc email").max(128).optional(),
  email: z.string().trim().email().max(128).optional(),
  username: z.string().trim().max(128).optional(),
  password: z.string().min(1, "Vui lòng nhập mật khẩu").max(128)
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token là bắt buộc").optional()
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(128).optional(),
  phone: z.string().trim().regex(/^(0|\+84)[0-9]{9,10}$/).optional().nullable()
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại"),
  newPassword: z.string().min(6, "Mật khẩu mới phải từ 6 ký tự trở lên").max(128)
});
