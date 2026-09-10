import React from "react";
import { Key, CheckCircle2, Clock, AlertTriangle, XCircle, Smartphone } from "lucide-react";

export function StatsCards({ stats, onFilterChange }) {
  if (!stats) return null;

  const cards = [
    {
      label: "Total Licenses",
      value: stats.total,
      icon: Key,
      color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
      filter: null
    },
    {
      label: "Active Licenses",
      value: stats.active,
      icon: CheckCircle2,
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      filter: "active"
    },
    {
      label: "Expiring (7d)",
      value: stats.expiringSoon,
      icon: Clock,
      color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      filter: "expiring"
    },
    {
      label: "Suspended",
      value: stats.suspended,
      icon: AlertTriangle,
      color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
      filter: "suspended"
    },
    {
      label: "Revoked / Expired",
      value: stats.revoked + stats.expired,
      icon: XCircle,
      color: "text-rose-400 bg-rose-500/10 border-rose-500/20",
      filter: "revoked"
    },
    {
      label: "Active Devices",
      value: stats.activeDevices,
      icon: Smartphone,
      color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
      filter: null
    }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            onClick={() => card.filter && onFilterChange && onFilterChange(card.filter)}
            className={`p-4 rounded-2xl bg-slate-900/90 border border-slate-800 transition-all ${
              card.filter ? "cursor-pointer hover:border-slate-700 hover:bg-slate-800/80" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {card.label}
              </span>
              <div className={`p-1.5 rounded-lg border ${card.color}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-100 tracking-tight">
              {card.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}
