import React from "react";
import { AlertTriangle, X } from "lucide-react";

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger", // danger, warning, success
  onConfirm,
  onCancel,
  loading = false
}) {
  if (!isOpen) return null;

  let btnColor = "bg-rose-600 hover:bg-rose-500 text-white focus:ring-rose-500";
  let iconColor = "text-rose-400 bg-rose-500/10 border-rose-500/20";

  if (variant === "warning") {
    btnColor = "bg-amber-600 hover:bg-amber-500 text-white focus:ring-amber-500";
    iconColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";
  } else if (variant === "success") {
    btnColor = "bg-emerald-600 hover:bg-emerald-500 text-white focus:ring-emerald-500";
    iconColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6">
        <button
          onClick={onCancel}
          disabled={loading}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl border ${iconColor} shrink-0`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 ${btnColor} ${
              loading ? "opacity-75 cursor-not-allowed" : ""
            }`}
          >
            {loading ? "Processing..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
