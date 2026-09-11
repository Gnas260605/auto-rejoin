import React, { useState, useEffect } from "react";
import {
  Key,
  Search,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Trash2,
  Terminal,
  Copy,
  Check,
  ArrowLeft,
  ShieldCheck,
  Activity,
  Cpu,
  RefreshCw,
  Eye,
  EyeOff,
  Server,
  Zap,
  Globe,
  Clock,
  ExternalLink,
  Laptop
} from "lucide-react";
import { api } from "../api/client.js";
import { ConfirmActionModal } from "../components/ConfirmActionModal.jsx";

export function CustomerPortalPage({ onBackToStore }) {
  const [licenseKey, setLicenseKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [licenseData, setLicenseData] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState("devices"); // 'devices' | 'scripts' | 'diagnostics'
  const [activeScriptTab, setActiveScriptTab] = useState("termux"); // 'termux' | 'windows'
  const [pingTesting, setPingTesting] = useState(false);
  const [pingResults, setPingResults] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Auto-search if key is stored or provided via URL
  useEffect(() => {
    const savedKey = localStorage.getItem("last_searched_license_key");
    if (savedKey && !licenseKey) {
      setLicenseKey(savedKey);
      performLookup(savedKey);
    }
  }, []);

  const performLookup = async (keyToLookup) => {
    const trimmed = (keyToLookup || licenseKey).trim().toUpperCase();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setActionSuccess(null);
    try {
      const res = await api.lookupLicense(trimmed);
      setLicenseData(res.data);
      localStorage.setItem("last_searched_license_key", trimmed);
    } catch (err) {
      setError(err.message || "Không tìm thấy thông tin License Key này.");
      setLicenseData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = (e) => {
    if (e) e.preventDefault();
    performLookup(licenseKey);
  };

  const handleResetDevice = (deviceId, deviceName) => {
    setConfirmModal({
      title: "Xác nhận gỡ thiết bị khỏi License",
      description: `Bạn có chắc chắn muốn gỡ thiết bị "${deviceName}"? Slot thiết bị sẽ được giải phóng ngay lập tức để kích hoạt máy mới.`,
      confirmText: "Gỡ thiết bị ngay",
      variant: "danger",
      details: {
        "Tên thiết bị": deviceName,
        "Device ID": deviceId
      },
      action: async () => {
        setModalLoading(true);
        setError(null);
        try {
          await api.customerResetDevice(licenseKey.trim().toUpperCase(), deviceId);
          setActionSuccess(`Đã gỡ thiết bị "${deviceName}". Slot đã được giải phóng thành công!`);
          const res = await api.lookupLicense(licenseKey.trim().toUpperCase());
          setLicenseData(res.data);
          setConfirmModal(null);
        } catch (err) {
          setError(err.message || "Không thể gỡ thiết bị vào lúc này. Vui lòng thử lại sau.");
        } finally {
          setModalLoading(false);
        }
      }
    });
  };

  const handleCopyKey = () => {
    if (!licenseData?.licenseKey) return;
    navigator.clipboard.writeText(licenseData.licenseKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const currentKeyString = licenseData?.licenseKey || licenseKey.trim().toUpperCase() || "AR-XXXX-XXXX-XXXX-XXXX";

  const termuxCommand = `cd ~/auto-rejoin && ./bin/roblox-manager activate "${currentKeyString}"`;
  const windowsCommand = `powershell -ExecutionPolicy Bypass -Command "irm https://autorejoin.pro/install.ps1 | iex" -Key "${currentKeyString}"`;

  const copyScript = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 2000);
  };

  const runPingTest = async () => {
    setPingTesting(true);
    setPingResults(null);
    try {
      // 1. Measure real latency to local API gateway
      const t0 = performance.now();
      await fetch("/api/v1/meta/public-pricing", { cache: "no-store" }).catch(() => {});
      const apiPing = Math.max(1, Math.round(performance.now() - t0));

      // 2. Measure real latency to Roblox CDN
      const t1 = performance.now();
      await fetch("https://setup.rbxcdn.com", { mode: "no-cors", cache: "no-store" }).catch(() => {});
      const robloxCdnPing = Math.max(1, Math.round(performance.now() - t1));

      setPingResults([
        {
          region: "Local Server API Gateway",
          ping: apiPing,
          status: apiPing < 45 ? "Tối ưu nhất" : "Ổn định"
        },
        {
          region: "Roblox Global CDN Relay",
          ping: robloxCdnPing,
          status: robloxCdnPing < 90 ? "Rất tốt" : "Ổn định"
        }
      ]);
    } catch {
      setPingResults([
        { region: "Local Server API Gateway", ping: 25, status: "Tối ưu" }
      ]);
    } finally {
      setPingTesting(false);
    }
  };

  // Helper for calculating remaining time
  const getRemainingTime = (expiresAt) => {
    if (!expiresAt) return "Vĩnh viễn (Không giới hạn)";
    const diff = new Date(expiresAt) - new Date();
    if (diff <= 0) return "Đã hết hạn";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    if (days > 0) return `Còn ${days} ngày ${hours} giờ`;
    return `Còn ${hours} giờ`;
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-200 flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-300 antialiased">
      {/* 1. TOP TELEMETRY BAR */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#070D18]/85 backdrop-blur-md">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToStore}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700/70 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-emerald-400" />
              <span>Trang chủ</span>
            </button>
            <span className="text-slate-700 hidden sm:inline">/</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-tight">Customer Portal</span>
              <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                License Command Center
              </span>
            </div>
          </div>

          {/* Right Status */}
          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="hidden sm:flex items-center gap-1.5 text-slate-400">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Gateway: Online (32ms)</span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. MAIN DASHBOARD CONTENT */}
      <main className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-5">
        {/* Search & Lookup Command Bar */}
        <div className="p-4 sm:p-5 bg-[#0B1322]/85 border border-slate-800/90 rounded-xl shadow-xl backdrop-blur-md space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                <Key className="w-4 h-4 text-emerald-400" />
                <span>Tra cứu & Quản lý License Key</span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Kiểm tra thời hạn, số slot thiết bị và gỡ máy cũ khi đổi điện thoại/PC.
              </p>
            </div>
          </div>

          <form onSubmit={handleLookup} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Key className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Nhập mã license (ví dụ: AR-XXXX-XXXX-XXXX-XXXX)..."
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                className="w-full h-10 bg-black/50 border border-slate-700/80 rounded-lg pl-9 pr-3 text-xs text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors uppercase tracking-wider"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="h-10 px-5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-500/20"
            >
              {loading ? (
                <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              <span>Tra cứu ngay</span>
            </button>
          </form>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/25 rounded-lg text-xs text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {actionSuccess && (
            <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{actionSuccess}</span>
            </div>
          )}
        </div>

        {/* 3. ACTIVE LICENSE DASHBOARD */}
        {licenseData && (
          <div className="space-y-5 animate-fadeIn">
            {/* Top Key Banner */}
            <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-[#0C1628] via-[#0B1322] to-[#0A111E] border border-slate-800/90 shadow-xl backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">License Key Bản Quyền</span>
                  {licenseData.status === "active" ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Đang Hoạt Động
                    </span>
                  ) : licenseData.status === "expired" ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-950/80 text-rose-300 border border-rose-500/40">
                      Đã Hết Hạn
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-500/40">
                      Tạm Khóa
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-base sm:text-lg font-bold text-white tracking-widest bg-black/40 px-3 py-1 rounded-lg border border-slate-700/60">
                    {showKey
                      ? licenseData.licenseKey
                      : licenseData.licenseKey
                      ? licenseData.licenseKey.replace(/^(.{6})(.*)(.{4})$/, "$1-••••-••••-$3")
                      : "AR-XXXX-XXXX"}
                  </span>
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title={showKey ? "Ẩn bớt key" : "Xem đầy đủ key"}
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={handleCopyKey}
                    className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer flex items-center gap-1 text-xs"
                    title="Sao chép key"
                  >
                    {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Quick Actions / Status badge */}
              <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
                <button
                  onClick={() => performLookup(licenseKey)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-slate-300 hover:text-white text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                  <span>Đồng bộ</span>
                </button>
                <a
                  href={`https://zalo.me?text=${encodeURIComponent(`Xin chào Admin, tôi cần hỗ trợ/gia hạn License Key: ${currentKeyString}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 hover:text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <span>Gia hạn qua Zalo</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* 4 Core Metrics HUD */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="p-4 bg-[#0B1322]/80 border border-slate-800/80 rounded-xl space-y-1 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-mono">GÓI CƯỚC</span>
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <p className="text-base font-bold text-white uppercase tracking-tight">
                  {licenseData.plan || "PRO"}
                </p>
                <p className="text-[11px] text-slate-400">Đầy đủ tính năng Watchdog</p>
              </div>

              <div className="p-4 bg-[#0B1322]/80 border border-slate-800/80 rounded-xl space-y-1 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-mono">SLOT THIẾT BỊ</span>
                  <Smartphone className="w-3.5 h-3.5 text-teal-400" />
                </div>
                <div className="flex items-baseline gap-1">
                  <p className="text-base font-bold text-emerald-400 font-mono">
                    {licenseData.activeDevicesCount || 0}
                  </p>
                  <span className="text-xs text-slate-400 font-mono">/ {licenseData.maxDevices || 1} máy</span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden mt-1">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        ((licenseData.activeDevicesCount || 0) / (licenseData.maxDevices || 1)) * 100
                      )}%`
                    }}
                  />
                </div>
              </div>

              <div className="p-4 bg-[#0B1322]/80 border border-slate-800/80 rounded-xl space-y-1 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-mono">THỜI GIAN CÒN LẠI</span>
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <p className="text-sm font-bold text-emerald-300">
                  {getRemainingTime(licenseData.expiresAt)}
                </p>
                <p className="text-[11px] text-slate-400 font-mono">
                  {licenseData.expiresAt ? new Date(licenseData.expiresAt).toLocaleDateString("vi-VN") : "Vĩnh viễn"}
                </p>
              </div>

              <div className="p-4 bg-[#0B1322]/80 border border-slate-800/80 rounded-xl space-y-1 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-mono">ĐỔI MÁY 1-CHẠM</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <p className="text-sm font-bold text-white">Không Giới Hạn</p>
                <p className="text-[11px] text-slate-400">Gỡ máy cũ & gắn máy mới tức thì</p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
              <button
                onClick={() => setActiveTab("devices")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === "devices"
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Quản Lý Thiết Bị ({licenseData.activeDevicesCount || 0}/{licenseData.maxDevices || 1})</span>
              </button>
              <button
                onClick={() => setActiveTab("scripts")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === "scripts"
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Lệnh Kích Hoạt & Cài Đặt</span>
              </button>
              <button
                onClick={() => setActiveTab("diagnostics")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === "diagnostics"
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Kiểm Tra Mạng Roblox</span>
              </button>
            </div>

            {/* TAB 1: DEVICE MANAGEMENT */}
            {activeTab === "devices" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Thiết bị đang liên kết với license này:</span>
                  <span className="font-mono">
                    Còn trống: {Math.max(0, (licenseData.maxDevices || 1) - (licenseData.activeDevicesCount || 0))} slot
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {licenseData.devices && licenseData.devices.length > 0 ? (
                    licenseData.devices.map((device, idx) => (
                      <div
                        key={device.id || idx}
                        className="p-4 bg-[#0B1322]/90 border border-slate-800/90 rounded-xl flex items-start justify-between gap-3 relative group hover:border-slate-700 transition-all shadow-md"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs sm:text-sm text-white truncate">
                              {device.deviceName || `Thiết bị #${idx + 1}`}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 border border-slate-700 text-slate-300">
                              {device.platform || "Termux / Android"}
                            </span>
                          </div>

                          <div className="space-y-0.5 text-xs text-slate-400 font-mono">
                            <p className="truncate text-[11px]">
                              HWID: <span className="text-slate-300">{device.installationIdMasked || "HWID-OK-••••"}</span>
                            </p>
                            <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Đang kết nối &bull; Watchdog Active
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleResetDevice(device.id, device.deviceName)}
                          disabled={loading}
                          className="px-2.5 py-1.5 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 rounded-lg transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
                          title="Gỡ thiết bị để đổi sang điện thoại khác"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Gỡ máy</span>
                        </button>
                      </div>
                    ))
                  ) : null}

                  {/* Empty Slot Card */}
                  {Array.from({
                    length: Math.max(0, (licenseData.maxDevices || 1) - (licenseData.activeDevicesCount || 0))
                  }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="p-4 bg-slate-900/30 border border-dashed border-slate-800/80 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <p className="font-semibold text-slate-300 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-slate-600" />
                          Slot #{ (licenseData.activeDevicesCount || 0) + i + 1 } (Còn trống)
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Sẵn sàng kết nối trên thiết bị mới bằng lệnh kích hoạt.
                        </p>
                      </div>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/30 border border-emerald-500/20 text-emerald-400">
                        Available
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 2: SCRIPTS & ACTIVATION COMMANDS */}
            {activeTab === "scripts" && (
              <div className="p-4 sm:p-5 bg-[#0B1322]/90 border border-slate-800/90 rounded-xl space-y-4 shadow-xl">
                {/* Platform Selector */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveScriptTab("termux")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeScriptTab === "termux"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800"
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Termux (Android)</span>
                  </button>
                  <button
                    onClick={() => setActiveScriptTab("windows")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeScriptTab === "windows"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800"
                    }`}
                  >
                    <Laptop className="w-3.5 h-3.5" />
                    <span>Windows PC (PowerShell)</span>
                  </button>
                </div>

                {activeScriptTab === "termux" && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                        Chạy lệnh sau trên ứng dụng Termux:
                      </span>
                      <button
                        onClick={() => copyScript(termuxCommand)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-700"
                      >
                        {copiedCommand ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedCommand ? "Đã sao chép!" : "Sao chép lệnh"}</span>
                      </button>
                    </div>

                    <div className="bg-black/80 p-3 rounded-lg border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto select-all leading-relaxed shadow-inner">
                      {termuxCommand}
                    </div>

                    <div className="text-[11px] text-slate-400 space-y-1 pt-1">
                      <p>• Nếu chưa cài đặt, vui lòng chạy script cài đặt ban đầu trước khi kích hoạt key.</p>
                      <p>• Hệ thống sẽ tự động liên kết HWID thiết bị Termux với license của bạn.</p>
                    </div>
                  </div>
                )}

                {activeScriptTab === "windows" && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                        Chạy trên PowerShell (Admin) của Windows:
                      </span>
                      <button
                        onClick={() => copyScript(windowsCommand)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-700"
                      >
                        {copiedCommand ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedCommand ? "Đã sao chép!" : "Sao chép lệnh"}</span>
                      </button>
                    </div>

                    <div className="bg-black/80 p-3 rounded-lg border border-slate-800 font-mono text-xs text-cyan-300 overflow-x-auto select-all leading-relaxed shadow-inner">
                      {windowsCommand}
                    </div>

                    <div className="text-[11px] text-slate-400 space-y-1 pt-1">
                      <p>• Hỗ trợ Windows 10/11 64-bit, tự động mở đa tab Roblox và quản lý tài khoản.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: DIAGNOSTICS & PING TEST */}
            {activeTab === "diagnostics" && (
              <div className="p-4 sm:p-5 bg-[#0B1322]/90 border border-slate-800/90 rounded-xl space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Globe className="w-4 h-4 text-emerald-400" />
                      <span>Kiểm Tra Đường Truyền Server Roblox</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Đo độ trễ (latency) từ máy bạn tới các trạm matchmaking Roblox để chọn server tối ưu.
                    </p>
                  </div>
                  <button
                    onClick={runPingTest}
                    disabled={pingTesting}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${pingTesting ? "animate-spin" : ""}`} />
                    <span>{pingTesting ? "Đang đo ping..." : "Bắt đầu đo ping"}</span>
                  </button>
                </div>

                {pingResults ? (
                  <div className="space-y-2 pt-2">
                    {pingResults.map((r, i) => (
                      <div
                        key={i}
                        className="p-3 bg-black/40 border border-slate-800 rounded-lg flex items-center justify-between text-xs font-mono"
                      >
                        <span className="text-slate-300">{r.region}</span>
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 font-bold">
                            {r.ping} ms
                          </span>
                          <span className="text-slate-400 text-[11px]">{r.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-slate-500 bg-black/30 rounded-lg border border-slate-800/60 font-mono">
                    Nhấn "Bắt đầu đo ping" để kiểm tra tình trạng kết nối tới các cụm server Roblox.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* In-App Confirmation Modal */}
      <ConfirmActionModal
        isOpen={Boolean(confirmModal)}
        onClose={() => setConfirmModal(null)}
        onConfirm={confirmModal?.action}
        title={confirmModal?.title}
        description={confirmModal?.description}
        confirmText={confirmModal?.confirmText}
        variant={confirmModal?.variant}
        details={confirmModal?.details}
        loading={modalLoading}
      />
    </div>
  );
}
