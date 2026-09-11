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
  CreditCard
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
    <div className="flex min-h-screen bg-[#080D17] text-slate-100">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-800/80 bg-[#0B1322] shrink-0 p-5">
        <div className="flex items-center gap-3 px-2 py-3 mb-6">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight text-slate-100">Auto Rejoin Pro</h1>
            <p className="text-xs text-slate-400 font-medium">License Authority</p>
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

          <div className="pt-4 pb-1">
            <span className="px-3.5 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Khách Hàng & Store
            </span>
          </div>

          <button
            onClick={() => onNavigate("storefront")}
            className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-teal-300 hover:bg-slate-800/60 transition-all"
          >
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="w-4 h-4 text-teal-400" />
              <span>Trang Bán Key</span>
            </div>
            <ExternalLink className="w-3 h-3 text-slate-500" />
          </button>

          <button
            onClick={() => onNavigate("portal")}
            className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60 transition-all"
          >
            <div className="flex items-center gap-2.5">
              <Search className="w-4 h-4 text-cyan-400" />
              <span>Cổng Tra Cứu Key</span>
            </div>
            <ExternalLink className="w-3 h-3 text-slate-500" />
          </button>
        </nav>

        <div className="pt-4 border-t border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-slate-400">Authority Backend</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500 uppercase">v0.1.0</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div className="truncate pr-2">
              <span className="block text-xs font-semibold text-slate-200 truncate">{admin?.username}</span>
              <span className="inline-block text-[10px] font-medium text-emerald-400 uppercase tracking-wider">
                {admin?.role}
              </span>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-black/70 backdrop-blur-sm">
          <div className="relative w-64 bg-slate-900 border-r border-slate-800 p-5 flex flex-col h-full">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 px-2 py-3 mb-6">
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl">
                <Terminal className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-bold text-sm tracking-tight text-slate-100">Auto Rejoin Pro</h1>
                <p className="text-xs text-slate-400 font-medium">Admin Console</p>
              </div>
            </div>
            <nav className="flex-1 space-y-1.5">
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
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-5 sm:px-8 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-sm text-slate-200">License Administration</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <span>Admin:</span>
              <span className="font-semibold text-slate-100">{admin?.username}</span>
              <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded text-[10px] font-bold uppercase">
                {admin?.role}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-5 sm:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
