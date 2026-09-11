import React, { useState } from "react";
import {
  Key,
  History,
  LogOut,
  Shield,
  Menu,
  X,
  Terminal,
  TrendingUp,
  ShoppingBag,
  Search,
  ExternalLink,
  Sliders,
  Code,
  Target,
  CreditCard,
  Globe,
  Radio,
  Sparkles
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

export function AdminLayout({ activePage = "dashboard", onNavigate, children }) {
  const { admin, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { id: "dashboard", label: "Tổng Quan & Doanh Thu", icon: TrendingUp },
    { id: "licenses", label: "Quản Lý License Key", icon: Key },
    { id: "payos", label: "Quản Lý PayOS & Cổng TT", icon: CreditCard },
    { id: "pricing", label: "Bảng Giá & Gói Cước", icon: Sliders },
    { id: "api", label: "Quản Lý API & Tích Hợp", icon: Code },
    { id: "marketing", label: "Google Ads & SEO", icon: Target },
    { id: "audits", label: "Nhật Ký Quản Trị", icon: History }
  ];

  return (
    <div className="flex min-h-screen bg-[#070C16] text-slate-100">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-800/80 bg-[#0B132B]/90 backdrop-blur-xl shrink-0 p-5">
        <div className="flex items-center gap-3 px-2 py-3 mb-6 bg-slate-950/50 rounded-2xl border border-slate-800/60 p-2.5">
          <div className="p-2 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/40 text-emerald-400 rounded-xl shadow-md shadow-emerald-500/10">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
              Auto Rejoin Pro
            </h1>
            <p className="text-[11px] text-emerald-400 font-semibold uppercase tracking-wider">
              Authority Console
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                  active
                    ? "bg-gradient-to-r from-emerald-500/20 to-cyan-500/10 text-emerald-300 border border-emerald-500/40 font-bold shadow-sm shadow-emerald-500/10"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? "text-emerald-400" : "text-slate-400"}`} />
                <span>{item.label}</span>
              </button>
            );
          })}

          <div className="pt-4 pb-1">
            <span className="px-3.5 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Khách Hàng & Storefront
            </span>
          </div>

          <button
            onClick={() => onNavigate("storefront")}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-teal-300 hover:bg-slate-800/50 transition-all border border-transparent hover:border-slate-800"
          >
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="w-4 h-4 text-teal-400" />
              <span>Trang Bán Key (Store)</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
          </button>

          <button
            onClick={() => onNavigate("portal")}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-cyan-300 hover:bg-slate-800/50 transition-all border border-transparent hover:border-slate-800"
          >
            <div className="flex items-center gap-2.5">
              <Search className="w-4 h-4 text-cyan-400" />
              <span>Cổng Tra Cứu (Portal)</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </nav>

        <div className="pt-4 border-t border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs text-slate-300 font-medium">Server Online</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              v4.0 Pro AI
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between shadow-inner">
            <div className="truncate pr-2">
              <span className="block text-xs font-bold text-white truncate">{admin?.username}</span>
              <span className="inline-block text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                {admin?.role}
              </span>
            </div>
            <button
              onClick={logout}
              title="Đăng xuất"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-black/80 backdrop-blur-md">
          <div className="relative w-64 bg-slate-900 border-r border-slate-800 p-5 flex flex-col h-full">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 px-2 py-3 mb-6">
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl">
                <Terminal className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-bold text-sm tracking-tight text-white">Auto Rejoin Pro</h1>
                <p className="text-xs text-slate-400">Admin Console</p>
              </div>
            </div>
            <nav className="flex-1 space-y-1.5 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      setMobileOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      active
                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? "text-emerald-400" : "text-slate-400"}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Đăng xuất</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-5 sm:px-8 border-b border-slate-800/80 bg-[#070C16]/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-sm text-slate-200 tracking-wide">
                Hệ Thống Quản Trị Trung Tâm
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300 shadow-sm">
              <span className="text-slate-400">Tài khoản:</span>
              <span className="font-bold text-white">{admin?.username}</span>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full text-[10px] font-extrabold uppercase border border-emerald-500/30">
                {admin?.role}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-7 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
