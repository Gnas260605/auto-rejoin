import React, { useState, useEffect } from "react";
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
  Zap,
  Sparkles,
  Layers,
  ChevronRight,
  Activity,
  CheckCircle2
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

export function AdminLayout({ activePage = "dashboard", onNavigate, onOpenCreateKey, children }) {
  const { admin, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString("vi-VN"));

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString("vi-VN"));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const navGroups = [
    {
      group: "QUẢN TRỊ CỐT LÕI",
      items: [
        { id: "dashboard", label: "Tổng Quan & Thống Kê", icon: TrendingUp, badge: "KPI" },
        { id: "licenses", label: "Quản Lý License Key", icon: Key, badge: "Core" }
      ]
    },
    {
      group: "THƯƠNG MẠI & THANH TOÁN",
      items: [
        { id: "products", label: "Sản Phẩm & Kho Key", icon: Layers, badge: "Commerce" },
        { id: "payos", label: "Cổng Thanh Toán PayOS", icon: CreditCard, badge: "Auto" },
        { id: "pricing", label: "Bảng Giá & Gói Cước", icon: Sliders }
      ]
    },
    {
      group: "HỆ THỐNG & PHÁT TRIỂN",
      items: [
        { id: "api", label: "Quản Lý API & Webhook", icon: Code },
        { id: "marketing", label: "Google Ads & SEO", icon: Target },
        { id: "audits", label: "Nhật Ký Quản Trị", icon: History }
      ]
    }
  ];

  return (
    <div className="flex min-h-screen bg-[#060B14] text-slate-100 antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex flex-col w-72 border-r border-slate-800/70 bg-[#09101F]/90 backdrop-blur-2xl shrink-0 p-5 z-40">
        {/* Brand Header */}
        <div className="flex items-center justify-between gap-3 px-3 py-3 mb-6 bg-gradient-to-b from-slate-900/90 to-slate-950/90 rounded-2xl border border-slate-800/80 shadow-lg shadow-black/40">
          <div className="flex items-center gap-3">
            <div className="relative p-2.5 bg-gradient-to-br from-emerald-500/20 via-cyan-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl shadow-inner">
              <Terminal className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-sm tracking-tight text-white font-heading">
                  Auto Rejoin Pro
                </h1>
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  AI v4
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Admin Control Hub
              </p>
            </div>
          </div>
        </div>

        {/* Quick Action Button */}
        <div className="mb-5">
          <button
            onClick={() => onNavigate("licenses")}
            className="w-full group flex items-center justify-center gap-2.5 px-4 py-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-extrabold rounded-xl text-xs shadow-md shadow-emerald-500/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <Zap className="w-4 h-4 fill-slate-950 transition-transform group-hover:rotate-12" />
            <span>Cấp License Nhanh</span>
          </button>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 space-y-6 overflow-y-auto pr-1">
          {navGroups.map((grp, gIdx) => (
            <div key={gIdx} className="space-y-1.5">
              <span className="px-3 text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
                {grp.group}
              </span>
              <div className="space-y-1 mt-1">
                {grp.items.map((item) => {
                  const Icon = item.icon;
                  const active = activePage === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.id)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                        active
                          ? "bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/10 font-bold"
                          : "text-slate-300 hover:text-white hover:bg-slate-800/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          className={`w-4 h-4 transition-colors ${
                            active ? "text-emerald-400" : "text-slate-400"
                          }`}
                        />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            active
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* External Links */}
          <div className="space-y-1.5 pt-2">
            <span className="px-3 text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
              KÊNH KHÁCH HÀNG
            </span>
            <div className="space-y-1 mt-1">
              <button
                onClick={() => onNavigate("storefront")}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-teal-300 hover:bg-slate-800/40 transition-all border border-transparent hover:border-slate-800"
              >
                <div className="flex items-center gap-3">
                  <ShoppingBag className="w-4 h-4 text-teal-400" />
                  <span>Trang Bán Key (Store)</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                onClick={() => onNavigate("portal")}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-cyan-300 hover:bg-slate-800/40 transition-all border border-transparent hover:border-slate-800"
              >
                <div className="flex items-center gap-3">
                  <Search className="w-4 h-4 text-cyan-400" />
                  <span>Cổng Tra Cứu (Portal)</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </div>
        </nav>

        {/* Footer Admin info */}
        <div className="pt-4 border-t border-slate-800/80 space-y-3 mt-auto">
          <div className="flex items-center justify-between px-2 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-slate-300 font-medium">Node Engine Online</span>
            </div>
            <span className="font-mono text-slate-400">{currentTime}</span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between shadow-inner">
            <div className="truncate pr-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="block text-xs font-bold text-white truncate">
                  {admin?.username || "Admin"}
                </span>
              </div>
              <span className="inline-block text-[10px] font-bold text-cyan-400 uppercase tracking-wider mt-0.5">
                {admin?.role || "Super Admin"}
              </span>
            </div>
            <button
              onClick={logout}
              title="Đăng xuất khỏi hệ thống"
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors border border-transparent hover:border-rose-500/20"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden bg-black/80 backdrop-blur-md">
          <div className="relative w-72 bg-[#09101F] border-r border-slate-800 p-5 flex flex-col h-full">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 px-2 py-3 mb-5">
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl">
                <Terminal className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-bold text-sm tracking-tight text-white font-heading">
                  Auto Rejoin Pro
                </h1>
                <p className="text-xs text-slate-400">Admin Console</p>
              </div>
            </div>

            <nav className="flex-1 space-y-4 overflow-y-auto">
              {navGroups.map((grp, gIdx) => (
                <div key={gIdx} className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 px-2">
                    {grp.group}
                  </span>
                  {grp.items.map((item) => {
                    const Icon = item.icon;
                    const active = activePage === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          onNavigate(item.id);
                          setMobileOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                          active
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            : "text-slate-300 hover:bg-slate-800/60"
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${active ? "text-emerald-400" : "text-slate-400"}`} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>

            <div className="pt-4 border-t border-slate-800 space-y-3">
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/10 rounded-xl border border-rose-500/20 transition-colors"
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
        {/* Sticky Topbar */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-8 border-b border-slate-800/80 bg-[#060B14]/85 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl border border-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="hidden sm:flex p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <span className="font-extrabold text-sm text-white tracking-tight flex items-center gap-1.5 font-heading">
                  Trung Tâm Quản Trị Hệ Thống
                </span>
                <span className="hidden md:inline-block text-[11px] text-slate-400 font-medium">
                  Giám sát thiết bị & phát hành bản quyền tự động
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick action button in header */}
            <button
              onClick={() => onNavigate("licenses")}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-emerald-300 font-bold text-xs rounded-xl border border-emerald-500/30 shadow-sm transition-all"
            >
              <Key className="w-3.5 h-3.5 text-emerald-400" />
              <span>Quản Lý Key</span>
            </button>

            {/* Admin Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 shadow-sm">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold text-white text-xs">{admin?.username || "Admin"}</span>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-lg text-[10px] font-black uppercase border border-emerald-500/30">
                {admin?.role || "Super Admin"}
              </span>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-4 sm:p-7 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
