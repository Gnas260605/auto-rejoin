import React, { useState, useEffect } from "react";
import {
  X,
  Key,
  Copy,
  Check,
  AlertTriangle,
  ShieldCheck,
  Gamepad2,
  Monitor,
  Calendar,
  Zap,
  Globe,
  FileText,
  RotateCcw,
  Sparkles
} from "lucide-react";
import { api } from "../api/client.js";

const POPULAR_GAMES = [
  { name: "Steal A Brainrot", placeId: "107778070777162", icon: "🧠" },
  { name: "Blox Fruits", placeId: "2753915549", icon: "⚔️" },
  { name: "Fisch", placeId: "16732694052", icon: "🎣" },
  { name: "King Legacy", placeId: "4520749081", icon: "👑" },
  { name: "Pet Simulator 99", placeId: "8737881037", icon: "🐾" },
  { name: "Tùy chỉnh", placeId: "", icon: "✏️" }
];

const DEVICE_PRESETS = [1, 2, 3, 5, 10, 20];

const EXPIRY_PRESETS = [
  { id: "trial_4h", label: "4 Giờ (Test)", hours: 4, days: null },
  { id: "1", label: "1 Ngày", hours: null, days: 1 },
  { id: "3", label: "3 Ngày", hours: null, days: 3 },
  { id: "7", label: "7 Ngày (1 Tuần)", hours: null, days: 7 },
  { id: "30", label: "30 Ngày (1 Tháng)", hours: null, days: 30, popular: true },
  { id: "90", label: "90 Ngày (3 Tháng)", hours: null, days: 90 },
  { id: "365", label: "1 Năm", hours: null, days: 365 },
  { id: "lifetime", label: "Vĩnh Viễn (Trọn đời)", hours: null, days: null },
  { id: "custom", label: "Tùy chọn ngày", hours: null, days: 30 }
];

export function CreateLicenseModal({ isOpen, onClose, onCreated, plans = [] }) {
  const [plan, setPlan] = useState("pro");
  const [maxDevices, setMaxDevices] = useState(5);
  const [expiryOption, setExpiryOption] = useState("30");
  const [customDays, setCustomDays] = useState(30);
  const [selectedGame, setSelectedGame] = useState("107778070777162");
  const [placeId, setPlaceId] = useState("107778070777162");
  const [antiAfk, setAntiAfk] = useState(false); // Default false to avoid focus stealing in multi-window
  const [joinLowServer, setJoinLowServer] = useState(true);
  const [apiUrl, setApiUrl] = useState(() => {
    return localStorage.getItem("preferred_api_tunnel") || window.location.origin;
  });
  const [customerName, setCustomerName] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Key generated state
  const [createdResult, setCreatedResult] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);

  useEffect(() => {
    if (apiUrl) {
      localStorage.setItem("preferred_api_tunnel", apiUrl.trim());
    }
  }, [apiUrl]);

  if (!isOpen) return null;

  const handleGameSelect = (g) => {
    setSelectedGame(g.placeId);
    if (g.placeId) {
      setPlaceId(g.placeId);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      let expiresInDays = null;
      let expiresInHours = null;
      if (expiryOption !== "lifetime") {
        if (expiryOption === "trial_4h") {
          expiresInHours = 4;
        } else {
          expiresInDays = expiryOption === "custom" ? Number(customDays) : Number(expiryOption);
        }
      }

      const cleanApiUrl = apiUrl.trim().replace(/\/$/, "");

      const res = await api.createLicense({
        plan,
        maxDevices: Number(maxDevices),
        expiresInHours,
        expiresInDays,
        placeId: placeId.trim() || "107778070777162",
        apiUrl: cleanApiUrl,
        antiAfk,
        joinLowServer,
        customerName: customerName.trim() || "Khách hàng"
      });

      if (res.ok && res.licenseKey) {
        setCreatedResult(res);
        if (onCreated) {
          onCreated(res.license);
        }
      } else {
        throw new Error(res.message || "Failed to create license");
      }
    } catch (err) {
      setError(err.message || "Failed to create license");
    } finally {
      setLoading(false);
    }
  };

  const copyText = (text, type) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === "key") {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else if (type === "cmd") {
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2000);
    } else if (type === "msg") {
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 2000);
    }
  };

  const handleClose = () => {
    setCreatedResult(null);
    setCopiedKey(false);
    setCopiedCmd(false);
    setCopiedMsg(false);
    setError("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700/70 rounded-2xl shadow-2xl overflow-hidden text-slate-100 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                {createdResult ? "Tạo License Thành Công" : "Tạo Mới License Key"}
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-normal">
                  Auto Rejoin Pro
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {createdResult
                  ? "Sao chép lệnh cài đặt hoặc gửi tin nhắn bàn giao cho khách hàng"
                  : "Thiết lập cấu hình Place ID, số máy, thời hạn và tự động sinh lệnh All-in-one"}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!createdResult ? (
            <form id="create-license-form" onSubmit={handleSubmit} className="space-y-4">
              {/* Row 1: Plan & Customer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Gói bản quyền (Plan)</label>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 capitalize"
                  >
                    {plans.length > 0 ? (
                      plans.map((p) => (
                        <option key={p.plan} value={p.plan}>
                          {p.plan.toUpperCase()} — {p.maxInstances} instances
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="basic">Basic (1 instance)</option>
                        <option value="standard">Standard (5 instances)</option>
                        <option value="pro">Pro (20 instances) — Khuyên dùng</option>
                        <option value="business">Business / VIP (100 instances)</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Tên khách hàng / Ghi chú</label>
                  <input
                    type="text"
                    placeholder="VD: UG Phone Nam, Khách Zalo 098..."
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Game / Place ID Selection */}
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <Gamepad2 className="w-3.5 h-3.5" /> Chọn Game Roblox / Place ID
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">Place ID: {placeId || "Chưa nhập"}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {POPULAR_GAMES.map((g) => (
                    <button
                      key={g.name}
                      type="button"
                      onClick={() => handleGameSelect(g)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border flex items-center gap-2 transition ${
                        selectedGame === g.placeId
                          ? "bg-cyan-500/20 border-cyan-500 text-cyan-300 ring-1 ring-cyan-500/50"
                          : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      <span className="text-base">{g.icon}</span>
                      <span className="truncate">{g.name}</span>
                    </button>
                  ))}
                </div>

                <div className="pt-1">
                  <input
                    type="text"
                    required
                    placeholder="Nhập Place ID tùy chỉnh (VD: 107778070777162)"
                    value={placeId}
                    onChange={(e) => {
                      setPlaceId(e.target.value.replace(/\D/g, ""));
                      setSelectedGame("");
                    }}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-sm font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Devices & Expiry */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Device Slots */}
                <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5 text-emerald-400" /> Số thiết bị chạy đồng thời
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {DEVICE_PRESETS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setMaxDevices(d)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                          maxDevices === d
                            ? "bg-emerald-500 text-slate-950 border-emerald-400"
                            : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        {d} {d === 5 ? "(UG Phone)" : "máy"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Expiry Options */}
                <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Thời hạn License
                  </label>
                  <select
                    value={expiryOption}
                    onChange={(e) => setExpiryOption(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {EXPIRY_PRESETS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  {expiryOption === "custom" && (
                    <input
                      type="number"
                      min="1"
                      max="3650"
                      placeholder="Số ngày"
                      value={customDays}
                      onChange={(e) => setCustomDays(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs mt-2"
                      required
                    />
                  )}
                </div>
              </div>

              {/* Advanced Flags (Anti-AFK & Low Server & Public Tunnel URL) */}
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span className="flex items-center gap-1.5 text-amber-400">
                    <Zap className="w-3.5 h-3.5" /> Tùy chọn nâng cao khi chạy Tool
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Anti-AFK Switch */}
                  <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700">
                    <input
                      type="checkbox"
                      checked={antiAfk}
                      onChange={(e) => setAntiAfk(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-500 bg-slate-800 border-slate-700 focus:ring-0"
                    />
                    <div>
                      <div className="text-xs font-medium text-slate-200">Bật Anti-AFK cảm ứng</div>
                      <div className="text-[11px] text-slate-400">Tắt (khuyên dùng) khi chạy nhiều tab UG Phone</div>
                    </div>
                  </label>

                  {/* Low Server Switch */}
                  <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700">
                    <input
                      type="checkbox"
                      checked={joinLowServer}
                      onChange={(e) => setJoinLowServer(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-500 bg-slate-800 border-slate-700 focus:ring-0"
                    />
                    <div>
                      <div className="text-xs font-medium text-slate-200">Tìm phòng ít người (Low Server)</div>
                      <div className="text-[11px] text-slate-400">Tự động chọn server 0 - 2 người chơi</div>
                    </div>
                  </label>
                </div>

                {/* API Public URL / Tunnel */}
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Globe className="w-3 h-3 text-cyan-400" /> Địa chỉ Server API / Cloudflare Tunnel (Cho máy Android kết nối):
                  </label>
                  <input
                    type="text"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder="https://your-tunnel.trycloudflare.com hoặc http://ip:3000"
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>
            </form>
          ) : (
            /* Result Screen */
            <div className="space-y-4 animate-fadeIn">
              {/* Raw Key Display Card */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/40 shadow-xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold tracking-wider uppercase text-emerald-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" /> Mã Bản Quyền (License Key)
                  </span>
                  <span className="text-xs text-slate-400">
                    {createdResult.license?.plan?.toUpperCase()} • {createdResult.license?.maxDevices} máy
                  </span>
                </div>

                <div className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-emerald-500/30">
                  <code className="text-lg font-mono font-bold text-emerald-300 tracking-wider break-all select-all">
                    {createdResult.licenseKey}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyText(createdResult.licenseKey, "key")}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-xs font-semibold transition shrink-0 ml-2"
                  >
                    {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    {copiedKey ? "Đã chép Key" : "Chép Key"}
                  </button>
                </div>
              </div>

              {/* All-in-One Command Box */}
              {createdResult.allInOneCommand && (
                <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/40 space-y-2 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold tracking-wider uppercase text-cyan-400 flex items-center gap-1.5">
                      <Zap className="w-4 h-4" /> Lệnh Setup 1 Dòng (Chạy ngay trên UG Phone / Termux)
                    </span>
                    <button
                      type="button"
                      onClick={() => copyText(createdResult.allInOneCommand, "cmd")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 text-xs font-bold transition shrink-0 shadow"
                    >
                      {copiedCmd ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiedCmd ? "Đã chép lệnh!" : "Sao chép lệnh All-in-One"}
                    </button>
                  </div>
                  <code className="block p-3 rounded-lg bg-black/90 border border-slate-800 text-xs text-cyan-300 font-mono break-all select-all leading-relaxed">
                    {createdResult.allInOneCommand}
                  </code>
                </div>
              )}

              {/* Handover Text */}
              {createdResult.handoverTemplate && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-emerald-400" /> Mẫu tin nhắn bàn giao khách (Zalo / Messenger)
                    </label>
                    <button
                      type="button"
                      onClick={() => copyText(createdResult.handoverTemplate, "msg")}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                    >
                      {copiedMsg ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedMsg ? "Đã chép tin nhắn!" : "Sao chép tất cả"}
                    </button>
                  </div>
                  <textarea
                    readOnly
                    rows={8}
                    value={createdResult.handoverTemplate}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 focus:outline-none leading-relaxed select-all"
                  />
                </div>
              )}

              {/* Security Reminder */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>
                  Hệ thống chỉ lưu mã băm bảo mật HMAC-SHA256. Hãy lưu lại License Key trước khi đóng cửa sổ này.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          {!createdResult ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                form="create-license-form"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    Đang tạo Key...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Tạo Key & Xuất Lệnh Chạy
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setCreatedResult(null);
                  setCopiedKey(false);
                  setCopiedCmd(false);
                  setCopiedMsg(false);
                }}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-slate-300 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition"
              >
                <RotateCcw className="w-4 h-4" /> Tạo thêm key khác
              </button>
              <div className="flex items-center gap-2">
                {createdResult.allInOneCommand && (
                  <button
                    type="button"
                    onClick={() => copyText(createdResult.allInOneCommand, "cmd")}
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition shadow"
                  >
                    {copiedCmd ? "✓ Đã chép lệnh" : "Sao chép lệnh cài đặt"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-5 py-2 text-sm font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition shadow-lg shadow-emerald-500/20"
                >
                  Hoàn tất
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
