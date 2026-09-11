import React from "react";
import { Key, CheckCircle2, Clock, AlertTriangle, XCircle, Smartphone } from "lucide-react";

export function StatsCards({ stats, onFilterChange, activeFilter }) {
  if (!stats) return null;

  const cards = [
    {
      label: "Tổng License",
      value: stats.total,
      icon: Key,
      color: "text-slate-300 bg-slate-800/80 border-slate-700",
      filter: "",
      glow: "hover:border-slate-600"
    },
    {
      label: "Đang Hoạt Động",
      value: stats.active,
      icon: CheckCircle2,
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
      filter: "active",
      glow: "hover:border-emerald-500/50 hover:shadow-emerald-500/10"
    },
    {
      label: "Sắp Hết Hạn (7d)",
      value: stats.expiringSoon,
      icon: Clock,
      color: "text-amber-400 bg-amber-500/10 border-amber-500/30",
      filter: "expiring",
      glow: "hover:border-amber-500/50 hover:shadow-amber-500/10"
    },
    {
      label: "Tạm Ngưng",
      value: stats.suspended,
      icon: AlertTriangle,
      color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
      filter: "suspended",
      glow: "hover:border-yellow-500/50"
    },
    {
      label: "Hết Hạn / Thu Hồi",
      value: (stats.revoked || 0) + (stats.expired || 0),
      icon: XCircle,
      color: "text-rose-400 bg-rose-500/10 border-rose-500/30",
      filter: "revoked",
      glow: "hover:border-rose-500/50"
    },
    {
      label: "Thiết Bị Online",
      value: stats.activeDevices,
      icon: Smartphone,
      color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
      filter: null,
      glow: "hover:border-cyan-500/50"
    }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        const isSelected = activeFilter === card.filter && card.filter !== null;

        return (
          <div
            key={idx}
            onClick={() => card.filter !== undefined && onFilterChange && onFilterChange(card.filter)}
            className={`p-3.5 rounded-2xl glass-panel border transition-all duration-200 cursor-pointer ${card.glow} ${
              isSelected
                ? "ring-2 ring-emerald-500 bg-slate-900 border-emerald-500/50 shadow-lg shadow-emerald-500/10"
                : "hover:bg-slate-800/60"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {card.label}
              </span>
              <div className={`p-1.5 rounded-xl border ${card.color}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-white tracking-tight font-mono">
              {card.value ?? 0}
            </div>
          </div>
        );
      })}
    </div>
  );
}
