import React, { useState } from "react";
import { X, Copy, Check, Download, AlertCircle, Layers } from "lucide-react";
import { api } from "../api/client.js";

export function BatchCreateModal({ isOpen, onClose, onCreated }) {
  const [count, setCount] = useState(5);
  const [plan, setPlan] = useState("pro");
  const [maxDevices, setMaxDevices] = useState(1);
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [generatedKeys, setGeneratedKeys] = useState(null);
  const [copiedAll, setCopiedAll] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.batchCreateLicenses({
        count: Number(count),
        plan,
        maxDevices: Number(maxDevices),
        expiresInDays: expiresInDays ? Number(expiresInDays) : null
      });
      setGeneratedKeys(res.items || []);
      if (onCreated) onCreated();
    } catch (err) {
      setError(err.message || "Không thể tạo danh sách license.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAll = () => {
    if (!generatedKeys) return;
    const text = generatedKeys.map((k) => k.rawKey).join("\n");
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleDownloadTxt = () => {
    if (!generatedKeys) return;
    const content = [
      `=== AUTO REJOIN PRO - BATCH EXPORT ===`,
      `Time: ${new Date().toLocaleString()}`,
      `Plan: ${plan.toUpperCase()} | Max Devices: ${maxDevices} | Duration: ${expiresInDays ? `${expiresInDays} Days` : "Lifetime"}`,
      `Total: ${generatedKeys.length}`,
      `------------------------------------------------`,
      ...generatedKeys.map((k, idx) => `${idx + 1}. ${k.rawKey}`),
      `================================================`
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `licenses_${plan}_${count}keys_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#0e1017] border border-zinc-800 rounded-lg shadow-xl p-5 text-zinc-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <div>
            <h3 className="font-semibold text-sm text-white">Tạo license hàng loạt</h3>
            <p className="text-xs text-zinc-400">Sinh 1-100 key cùng lúc</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="py-4 overflow-y-auto flex-1 space-y-4 text-xs">
          {error && (
            <div className="flex items-center gap-2 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded text-xs text-rose-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!generatedKeys ? (
            <form onSubmit={handleSubmit} className="space-y-3" id="batch-form">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">Số lượng key (1-100)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={count}
                    onChange={(e) => setCount(e.target.value)}
                    className="w-full h-9 bg-black/50 border border-zinc-700/80 rounded px-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">Gói cước (Plan)</label>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                    className="w-full h-9 bg-black/50 border border-zinc-700/80 rounded px-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="basic">Basic (1 Slot)</option>
                    <option value="pro">Pro (2 Slots)</option>
                    <option value="vip">VIP (4 Slots)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">Số máy tối đa / key</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={maxDevices}
                    onChange={(e) => setMaxDevices(e.target.value)}
                    className="w-full h-9 bg-black/50 border border-zinc-700/80 rounded px-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">Thời hạn (ngày - để trống = vĩnh viễn)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Vĩnh viễn"
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(e.target.value)}
                    className="w-full h-9 bg-black/50 border border-zinc-700/80 rounded px-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded flex items-center justify-between text-xs text-emerald-400">
                <span>Đã tạo thành công {generatedKeys.length} license keys.</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={handleCopyAll}
                    className="flex items-center gap-1 px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs transition-colors"
                  >
                    {copiedAll ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedAll ? "Đã copy" : "Copy tất cả"}</span>
                  </button>
                  <button
                    onClick={handleDownloadTxt}
                    className="flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    <span>Tải file .txt</span>
                  </button>
                </div>
              </div>

              <div className="bg-black/60 border border-zinc-800 rounded p-2.5 max-h-56 overflow-y-auto font-mono text-xs text-zinc-300 space-y-1 select-all">
                {generatedKeys.map((item, idx) => (
                  <div key={item.id} className="flex items-center justify-between py-0.5 border-b border-zinc-850 last:border-0 hover:bg-zinc-900/50 px-1.5 rounded">
                    <span className="text-zinc-600 text-[11px]">#{idx + 1}</span>
                    <span className="font-medium text-emerald-300">{item.rawKey}</span>
                    <span className="text-[10px] text-zinc-500 uppercase">{item.plan}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-zinc-800/80 flex justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-3 h-9 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            {generatedKeys ? "Đóng" : "Hủy"}
          </button>
          {!generatedKeys && (
            <button
              type="submit"
              form="batch-form"
              disabled={loading}
              className="h-9 px-4 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Layers className="w-3.5 h-3.5" />
              )}
              <span>{loading ? "Đang tạo..." : `Tạo ${count} key`}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
