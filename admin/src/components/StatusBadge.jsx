import React from "react";

export function StatusBadge({ status, className = "" }) {
  const norm = (status || "").toLowerCase();

  let styles = "bg-slate-800 text-slate-300 border-slate-700";
  let dotColor = "bg-slate-400";
  let label = status || "Unknown";

  if (norm === "active") {
    styles = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    dotColor = "bg-emerald-400";
    label = "Active";
  } else if (norm === "suspended") {
    styles = "bg-amber-500/10 text-amber-400 border-amber-500/30";
    dotColor = "bg-amber-400";
    label = "Suspended";
  } else if (norm === "revoked") {
    styles = "bg-rose-500/10 text-rose-400 border-rose-500/30";
    dotColor = "bg-rose-400";
    label = "Revoked";
  } else if (norm === "expired") {
    styles = "bg-orange-500/10 text-orange-400 border-orange-500/30";
    dotColor = "bg-orange-400";
    label = "Expired";
  } else if (norm === "disabled") {
    styles = "bg-slate-800 text-slate-400 border-slate-700";
    dotColor = "bg-slate-500";
    label = "Disabled";
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      {label}
    </span>
  );
}
