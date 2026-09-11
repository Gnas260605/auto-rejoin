import React, { useState } from "react";
import { X, Landmark, Check, Save, Settings, Sparkles } from "lucide-react";

export function PaymentSettingsModal({ isOpen, onClose }) {
  const defaultSettings = {
    bank: "MB",
    accountNumber: "0987654321",
    accountName: "NGUYEN VAN SANG",
    discordWebhook: "",
    telegramBotToken: "",
    telegramChatId: ""
  };

  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem("store_payment_settings");
      return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    localStorage.setItem("store_payment_settings", JSON.stringify(settings));
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 text-slate-100 flex flex-col max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Cấu Hình Shop & Thông Báo</h3>
              <p className="text-xs text-slate-400">Tài khoản VietQR & Webhook Discord/Telegram</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="py-4 space-y-4 text-xs">
          <div>
            <h4 className="font-bold uppercase tracking-wider text-[11px] mb-3 text-teal-400">
              1. Thông Tin Nhận Tiền VietQR
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Ngân Hàng
                </label>
                <select
                  value={settings.bank}
                  onChange={(e) => setSettings({ ...settings, bank: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="MB">MB Bank</option>
                  <option value="VCB">Vietcombank</option>
                  <option value="TCB">Techcombank</option>
                  <option value="VPB">VPBank</option>
                  <option value="ACB">ACB</option>
                  <option value="ICB">VietinBank</option>
                  <option value="BIDV">BIDV</option>
                  <option value="TPB">TPBank</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Số Tài Khoản
                </label>
                <input
                  type="text"
                  value={settings.accountNumber}
                  onChange={(e) => setSettings({ ...settings, accountNumber: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-teal-500"
                  required
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="block font-medium text-slate-300 mb-1">
                Tên Chủ Tài Khoản (Không Dấu)
              </label>
              <input
                type="text"
                value={settings.accountName}
                onChange={(e) => setSettings({ ...settings, accountName: e.target.value.toUpperCase() })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white uppercase focus:outline-none focus:border-teal-500"
                required
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80">
            <h4 className="font-bold uppercase tracking-wider text-[11px] mb-3 text-emerald-400">
              2. Thông Báo Đơn Hàng Mới (Webhooks)
            </h4>

            <div className="space-y-3">
              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Discord Webhook URL (Nhận thông báo khi có đơn mới)
                </label>
                <input
                  type="url"
                  placeholder="https://discord.com/api/webhooks/..."
                  value={settings.discordWebhook || ""}
                  onChange={(e) => setSettings({ ...settings, discordWebhook: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Telegram Bot Token (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    placeholder="123456:ABC-DEF..."
                    value={settings.telegramBotToken || ""}
                    onChange={(e) => setSettings({ ...settings, telegramBotToken: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Telegram Chat ID
                  </label>
                  <input
                    type="text"
                    placeholder="-10012345678"
                    value={settings.telegramChatId || ""}
                    onChange={(e) => setSettings({ ...settings, telegramChatId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-400 shrink-0" />
            <span>Hệ thống sẽ tự động gửi tin nhắn báo đơn kèm License Key vào Discord / Telegram ngay khi khách bấm thanh toán.</span>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-teal-950/30"
            >
              {savedSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {savedSuccess ? "Đã Lưu!" : "Lưu Cài Đặt"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
