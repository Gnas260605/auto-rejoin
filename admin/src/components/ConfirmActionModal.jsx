import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Trash2,
  XCircle,
  Clock,
  X,
  ShieldAlert,
  Loader2
} from "lucide-react";

export function ConfirmActionModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Xác nhận thao tác",
  description = "Bạn có chắc chắn muốn thực hiện thao tác này?",
  confirmText = "Xác nhận",
  cancelText = "Hủy bỏ",
  variant = "danger", // "danger" | "warning" | "success" | "info"
  loading = false,
  details = null
}) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: Trash2,
      iconBg: "bg-rose-500/15 border-rose-500/30 text-rose-400",
      btnBg: "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20",
      border: "border-rose-500/30"
    },
    warning: {
      icon: AlertTriangle,
      iconBg: "bg-amber-500/15 border-amber-500/30 text-amber-400",
      btnBg: "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20",
      border: "border-amber-500/30"
    },
    success: {
      icon: CheckCircle2,
      iconBg: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
      btnBg: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20",
      border: "border-emerald-500/30"
    },
    info: {
      icon: ShieldAlert,
      iconBg: "bg-cyan-500/15 border-cyan-500/30 text-cyan-400",
      btnBg: "bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/20",
      border: "border-cyan-500/30"
    }
  };

  const current = variantStyles[variant] || variantStyles.danger;
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className={`relative w-full max-w-md bg-[#0D1524] border ${current.border} rounded-2xl shadow-2xl p-5 text-slate-200 animate-in zoom-in-95 duration-150`}>
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content Header */}
        <div className="flex items-start gap-3.5 mb-4">
          <div className={`p-2.5 rounded-xl border ${current.iconBg} shrink-0`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="pr-6">
            <h3 className="text-sm font-bold text-white tracking-tight">{title}</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{description}</p>
          </div>
        </div>

        {/* Optional Details Key-Value Box */}
        {details && Object.keys(details).length > 0 && (
          <div className="mb-4 p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5 text-xs font-mono">
            {Object.entries(details).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between">
                <span className="text-slate-500">{k}:</span>
                <span className="font-semibold text-slate-200">{v}</span>
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800/80">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-3.5 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-lg font-bold text-xs shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${current.btnBg}`}
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            <span>{loading ? "Đang xử lý..." : confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
