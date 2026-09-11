import React, { useState } from "react";
import {
  Copy,
  Check,
  Smartphone,
  Monitor,
  Terminal,
  ExternalLink,
  ShieldCheck,
  Zap,
  HelpCircle,
  RefreshCw,
  ArrowRight,
  BookOpen
} from "lucide-react";

export function QuickStartCard({ licenseKey, planName = "Pro", onNavigateToPortal, onBuyMore }) {
  const [activeTab, setActiveTab] = useState("termux"); // "termux" | "pc"
  const [placeId, setPlaceId] = useState("107778070777162");
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const installCommand = `cd ~; rm -rf auto-rejoin; mkdir -p auto-rejoin; cd auto-rejoin; curl -fSL https://raw.githubusercontent.com/Gnas260605/auto-rejoin/main/setup.sh -o setup.sh; AUTO_REJOIN_LICENSE_API="${window.location.origin}" AUTO_REJOIN_LICENSE_MODE=required LICENSE_KEY="${licenseKey || ""}" JOIN_LOW_SERVER=true LOW_SERVER_MIN_PLAYERS=0 LOW_SERVER_MAX_PLAYERS=2 LOW_SERVER_STRICT=true bash setup.sh ${placeId || "107778070777162"}`;

  const copyKey = () => {
    if (!licenseKey) return;
    navigator.clipboard.writeText(licenseKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const copyCommand = () => {
    navigator.clipboard.writeText(installCommand);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-[#091524] to-[#060D18] p-6 text-slate-200 shadow-2xl shadow-emerald-500/10 space-y-6 animate-in fade-in duration-300">
      {/* 1. Header & Key Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight">
                Kích Hoạt Thành Công & Hướng Dẫn Cài Đặt
              </h3>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-semibold uppercase">
                Gói {planName}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Vui lòng lưu lại License Key và làm theo các bước bên dưới để bắt đầu sử dụng.
            </p>
          </div>
        </div>

        {onBuyMore && (
          <button
            onClick={onBuyMore}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white text-xs font-medium transition-colors self-start sm:self-auto"
          >
            Mua thêm key
          </button>
        )}
      </div>

      {/* 2. Key Display Box */}
      <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
        <div>
          <span className="text-[11px] font-mono uppercase text-slate-500 block mb-1">
            License Key của bạn
          </span>
          <span className="font-mono text-base sm:text-lg font-bold text-emerald-400 tracking-wider select-all">
            {licenseKey || "AR-XXXX-XXXX-XXXX-XXXX"}
          </span>
        </div>
        <button
          onClick={copyKey}
          className="h-9 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 shrink-0"
        >
          {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span>{copiedKey ? "Đã sao chép Key" : "Sao chép Key"}</span>
        </button>
      </div>

      {/* 3. Setup Method Tabs */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
          <button
            onClick={() => setActiveTab("termux")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "termux"
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>📱 Android & Termux (Khuyên Dùng)</span>
          </button>
          <button
            onClick={() => setActiveTab("pc")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "pc"
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>💻 Windows & Giả Lập</span>
          </button>
        </div>

        {/* Tab 1: Termux */}
        {activeTab === "termux" && (
          <div className="space-y-3.5 text-xs text-slate-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-[11px]">1</span>
                  <span>Mở ứng dụng Termux</span>
                </div>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Cài đặt Termux từ F-Droid hoặc file APK chính thức trên điện thoại Android của bạn.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-[11px]">2</span>
                  <span>Chạy lệnh cài đặt</span>
                </div>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Sao chép lệnh bên dưới và dán vào cửa sổ Termux để cài đặt công cụ tự động.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-[11px]">3</span>
                  <span>Nhập Key & Bắt đầu</span>
                </div>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Dán License Key khi tool yêu cầu. Tool sẽ tự động quét server ít người và chống AFK 24/7.
                </p>
              </div>
            </div>

            {/* Command Copy Box */}
            <div className="p-3.5 rounded-xl bg-[#070D18] border border-slate-800/90 space-y-2">
              <div className="space-y-1">
                <label className="text-[11px] font-mono text-slate-400 uppercase block">
                  Place ID game can vao
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{3,20}"
                  value={placeId}
                  onChange={(e) => setPlaceId(e.target.value.replace(/\D/g, ""))}
                  className="w-full px-3 py-2 rounded-lg bg-black/70 border border-slate-800 text-emerald-300 font-mono text-xs outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  Lệnh cài đặt 1-chạm (One-line Install)
                </span>
                <span className="text-slate-500">Tự động cấu hình môi trường</span>
              </div>
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-black/70 border border-slate-800 font-mono text-xs text-emerald-300">
                <code className="truncate select-all">{installCommand}</code>
                <button
                  onClick={copyCommand}
                  className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-[11px] font-medium transition-colors shrink-0 flex items-center gap-1"
                >
                  {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCmd ? "Đã chép lệnh" : "Sao chép"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: PC / Emulators */}
        {activeTab === "pc" && (
          <div className="space-y-3.5 text-xs text-slate-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-[11px]">1</span>
                  <span>Mở Giả Lập / Windows</span>
                </div>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Mở LDPlayer / BlueStacks / NoxPlayer hoặc trình duyệt Roblox trên máy tính.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-[11px]">2</span>
                  <span>Dán License Key</span>
                </div>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Nhập License Key vào file cấu hình `config.json` hoặc giao diện chạy tool.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-[11px]">3</span>
                  <span>Treo Multi-Clone</span>
                </div>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Hệ thống tự động phân bổ server vắng khác nhau cho từng tab giả lập.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Quick Support & Self-Service Links */}
      <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-400">
          <BookOpen className="w-4 h-4 text-emerald-400" />
          <span>Cần đổi sang máy khác?</span>
          {onNavigateToPortal && (
            <button
              onClick={onNavigateToPortal}
              className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-4"
            >
              Vào Cổng Tra Cứu Key để gỡ máy cũ &rarr;
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://discord.gg"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Hỗ trợ kỹ thuật 24/7</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
