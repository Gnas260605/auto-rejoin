import React, { useState } from "react";
import { Terminal, Lock, User, AlertTriangle, ArrowRight, Eye, EyeOff, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

export function LoginPage({ onBackToStore }) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(username.trim(), password);
    } catch (err) {
      if (err.code === "RATE_LIMITED") {
        setError("Quá nhiều lần thử sai. Vui lòng đợi 15 phút trước khi thử lại.");
      } else if (err.code === "ADMIN_DISABLED") {
        setError("Tài khoản quản trị viên này đã bị vô hiệu hóa.");
      } else {
        setError("Tài khoản hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (u, p) => {
    setUsername(u);
    setPassword(p);
    setError("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#060B14] via-[#0B132B] to-[#060B14] relative overflow-hidden">
      {/* Glow ambient background lights */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md bg-slate-900/80 border border-slate-700/60 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl animate-fadeIn">
        {/* Header */}
        <div className="text-center mb-7">
          <div className="inline-flex p-3.5 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/40 text-emerald-400 rounded-2xl mb-3.5 shadow-lg shadow-emerald-500/10">
            <Terminal className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
            Auto Rejoin Pro
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
              Authority
            </span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">Hệ Thống Quản Trị Bản Quyền & Điều Khiển</p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-start gap-2.5 animate-fadeIn">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Tên Quản Trị Viên (Username)
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="VD: sang123 hoặc sysadmin"
                autoComplete="username"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/90 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Mật Khẩu (Password)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-950/90 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 p-0.5"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Quick Account Suggestions */}
          <div className="pt-1 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Chọn nhanh tài khoản:</span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickFill("sang123", "Sang260605@")}
                className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition"
              >
                sang123
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill("sysadmin", "admin123")}
                className="px-2 py-0.5 rounded text-[11px] font-medium bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition"
              >
                sysadmin
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-3 py-3 px-4 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 font-extrabold rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Đang Đăng Nhập...</span>
              </>
            ) : (
              <>
                <span>Đăng Nhập Quản Trị</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
          {onBackToStore ? (
            <button
              onClick={onBackToStore}
              type="button"
              className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors flex items-center gap-1"
            >
              &larr; Về Trang Bán Key
            </button>
          ) : (
            <span />
          )}
          <span className="text-slate-500 font-mono text-[11px]">v4.0 Pro AI</span>
        </div>
      </div>
    </div>
  );
}
