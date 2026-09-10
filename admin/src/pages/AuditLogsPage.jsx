import React, { useState, useEffect, useCallback } from "react";
import { History, RefreshCw, ChevronLeft, ChevronRight, ShieldAlert, Filter } from "lucide-react";
import { api } from "../api/client.js";

export function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [actionFilter, setActionFilter] = useState("");

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const res = await api.listAuditLogs({
        page,
        limit: 25,
        action: actionFilter || undefined
      });

      if (res.ok) {
        setLogs(res.items || []);
        setTotalPages(res.totalPages || 1);
        setTotalItems(res.total || 0);
      }
    } catch (err) {
      setError(err.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const formatDate = (isoString) => {
    if (!isoString) return "—";
    const d = new Date(isoString);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Admin Audit Trail</h2>
          <p className="text-sm text-slate-400 mt-1">
            Immutable log of all administrative actions, logins, and license modifications
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <option value="">All Actions</option>
            <option value="admin_login_success">Login Success</option>
            <option value="admin_login_failed">Login Failed</option>
            <option value="license_created">License Created</option>
            <option value="license_updated">License Updated</option>
            <option value="license_suspended">License Suspended</option>
            <option value="license_reactivated">License Reactivated</option>
            <option value="license_revoked">License Revoked</option>
            <option value="device_revoked">Device Revoked</option>
          </select>

          <button
            onClick={loadLogs}
            title="Refresh"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-xl">
        {error ? (
          <div className="p-8 text-center text-rose-400 text-sm">{error}</div>
        ) : logs.length === 0 && !loading ? (
          <div className="p-12 text-center text-slate-500">
            <History className="w-10 h-10 mx-auto mb-3 text-slate-600 opacity-60" />
            <p className="text-base font-semibold text-slate-400">No audit logs recorded yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 border-b border-slate-800 uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-3 px-6 font-semibold">Timestamp</th>
                  <th className="py-3 px-6 font-semibold">Admin</th>
                  <th className="py-3 px-6 font-semibold">Action</th>
                  <th className="py-3 px-6 font-semibold">Target</th>
                  <th className="py-3 px-6 font-semibold">IP Address</th>
                  <th className="py-3 px-6 font-semibold">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-6 text-slate-400 font-mono">{formatDate(log.createdAt)}</td>
                    <td className="py-3.5 px-6 font-semibold text-slate-200">
                      {log.adminUsername || (log.adminUserId ? `User #${log.adminUserId}` : "System / Anonymous")}
                    </td>
                    <td className="py-3.5 px-6">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full font-mono text-[11px] font-semibold border ${
                          log.action.includes("failed") || log.action.includes("revoked")
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            : log.action.includes("suspended")
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 font-mono text-slate-300">
                      {log.targetType} {log.targetId ? `#${log.targetId}` : ""}
                    </td>
                    <td className="py-3.5 px-6 font-mono text-slate-500">{log.ipAddress || "—"}</td>
                    <td className="py-3.5 px-6 text-slate-400 font-mono text-[11px] max-w-sm truncate">
                      {log.metadata ? JSON.stringify(log.metadata) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-6 py-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing <span className="font-semibold text-slate-200">{logs.length}</span> of{" "}
            <span className="font-semibold text-slate-200">{totalItems}</span> events
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>
              Page <span className="font-semibold text-slate-200">{page}</span> of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
