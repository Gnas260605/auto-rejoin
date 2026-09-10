import React, { useState, useEffect, useCallback } from "react";
import {
  Key,
  Plus,
  Search,
  RefreshCw,
  Eye,
  Calendar,
  AlertTriangle,
  Play,
  Pause,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Filter
} from "lucide-react";
import { api } from "../api/client.js";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { StatsCards } from "../components/StatsCards.jsx";
import { CreateLicenseModal } from "../components/CreateLicenseModal.jsx";
import { ConfirmModal } from "../components/ConfirmModal.jsx";

export function LicensesPage({ onSelectLicense }) {
  const [licenses, setLicenses] = useState([]);
  const [stats, setStats] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters & Pagination
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    variant: "danger",
    action: null
  });
  const [extendModal, setExtendModal] = useState({ isOpen: false, license: null, days: 30 });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [licRes, statsRes, plansRes] = await Promise.all([
        api.listLicenses({
          page,
          limit: 15,
          search: search || undefined,
          status: statusFilter || undefined,
          plan: planFilter || undefined
        }),
        api.getStats(),
        api.getPlans()
      ]);

      if (licRes.ok) {
        setLicenses(licRes.items || []);
        setTotalPages(licRes.totalPages || 1);
        setTotalItems(licRes.total || 0);
      }
      if (statsRes.ok) {
        setStats(statsRes.stats);
      }
      if (plansRes.ok) {
        setPlans(plansRes.plans || []);
      }
    } catch (err) {
      setError(err.message || "Failed to load licenses");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, planFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Action handlers with confirmation
  const handleSuspend = (license) => {
    setConfirmModal({
      isOpen: true,
      title: "Suspend License?",
      message: `Are you sure you want to suspend license ${license.prefix}...${license.last4}? Connected clients will receive a SUSPENDED error on their next confirmation cycle.`,
      confirmText: "Suspend License",
      variant: "warning",
      action: async () => {
        await api.suspendLicense(license.id);
        loadData();
      }
    });
  };

  const handleReactivate = (license) => {
    setConfirmModal({
      isOpen: true,
      title: "Reactivate License?",
      message: `Reactivate license ${license.prefix}...${license.last4}? Connected clients will be able to validate successfully again.`,
      confirmText: "Reactivate",
      variant: "success",
      action: async () => {
        await api.reactivateLicense(license.id);
        loadData();
      }
    });
  };

  const handleRevoke = (license) => {
    setConfirmModal({
      isOpen: true,
      title: "Revoke License Permanently?",
      message: `Warning: Revoking license ${license.prefix}...${license.last4} is irreversible. All issued device tokens will be revoked immediately and existing clients will fail validation.`,
      confirmText: "Revoke Permanently",
      variant: "danger",
      action: async () => {
        await api.revokeLicense(license.id);
        loadData();
      }
    });
  };

  const handleExtendSubmit = async (e) => {
    e.preventDefault();
    if (!extendModal.license) return;
    try {
      await api.extendLicense(extendModal.license.id, Number(extendModal.days));
      setExtendModal({ isOpen: false, license: null, days: 30 });
      loadData();
    } catch (err) {
      alert(`Extend failed: ${err.message}`);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return "Lifetime";
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 tracking-tight">License Management</h2>
          <p className="text-sm text-slate-400 mt-1">
            Create, inspect, and enforce device allocations for Auto Rejoin Pro
          </p>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold rounded-xl text-sm shadow-lg shadow-emerald-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Create License</span>
        </button>
      </div>

      {/* Metrics Header */}
      <StatsCards
        stats={stats}
        onFilterChange={(f) => {
          setStatusFilter(f === "expiring" ? "" : f);
          setPage(1);
        }}
      />

      {/* Controls / Filter Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by prefix, last 4 digits, or ID..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 capitalize"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="revoked">Revoked</option>
            <option value="expired">Expired</option>
          </select>

          <select
            value={planFilter}
            onChange={(e) => {
              setPlanFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 capitalize"
          >
            <option value="">All Plans</option>
            {plans.map((p) => (
              <option key={p.plan} value={p.plan}>
                {p.plan}
              </option>
            ))}
          </select>

          <button
            onClick={loadData}
            title="Refresh"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
        {error ? (
          <div className="p-8 text-center text-rose-400 text-sm flex items-center justify-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        ) : licenses.length === 0 && !loading ? (
          <div className="p-12 text-center text-slate-500">
            <Key className="w-10 h-10 mx-auto mb-3 text-slate-600 opacity-60" />
            <p className="text-base font-semibold text-slate-400">No licenses found</p>
            <p className="text-xs text-slate-500 mt-1">Try adjusting your search criteria or create a new license.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-3.5 px-5 font-semibold">License Key</th>
                  <th className="py-3.5 px-5 font-semibold">Plan</th>
                  <th className="py-3.5 px-5 font-semibold">Status</th>
                  <th className="py-3.5 px-5 font-semibold">Devices</th>
                  <th className="py-3.5 px-5 font-semibold">Expires</th>
                  <th className="py-3.5 px-5 font-semibold">Created</th>
                  <th className="py-3.5 px-5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {licenses.map((lic) => (
                  <tr key={lic.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                          {lic.displayKey}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">#{lic.id}</span>
                      </div>
                    </td>
                    <td className="py-4 px-5">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-bold uppercase bg-slate-800 text-slate-200 border border-slate-700">
                        {lic.plan}
                      </span>
                      <span className="text-xs text-slate-500 block mt-0.5">
                        {lic.maxInstances} instances
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      <StatusBadge status={lic.status} />
                    </td>
                    <td className="py-4 px-5">
                      <span className="font-medium text-slate-200">
                        {lic.activeDeviceCount} / {lic.maxDevices}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-xs text-slate-400">
                      {formatDate(lic.expiresAt)}
                    </td>
                    <td className="py-4 px-5 text-xs text-slate-500">
                      {formatDate(lic.createdAt)}
                    </td>
                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onSelectLicense(lic.id)}
                          title="View Details"
                          className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setExtendModal({ isOpen: true, license: lic, days: 30 })}
                          title="Extend Duration"
                          className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                        >
                          <Calendar className="w-4 h-4" />
                        </button>
                        {lic.status === "active" ? (
                          <button
                            onClick={() => handleSuspend(lic)}
                            title="Suspend License"
                            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                          >
                            <Pause className="w-4 h-4" />
                          </button>
                        ) : lic.status === "suspended" ? (
                          <button
                            onClick={() => handleReactivate(lic)}
                            title="Reactivate License"
                            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        ) : null}
                        {lic.status !== "revoked" && (
                          <button
                            onClick={() => handleRevoke(lic)}
                            title="Revoke License"
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="px-5 py-3.5 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing <span className="font-semibold text-slate-200">{licenses.length}</span> of{" "}
            <span className="font-semibold text-slate-200">{totalItems}</span> licenses
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>
              Page <span className="font-semibold text-slate-200">{page}</span> of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Create License Modal */}
      <CreateLicenseModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={() => loadData()}
        plans={plans}
      />

      {/* Confirm Action Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        variant={confirmModal.variant}
        onConfirm={async () => {
          if (confirmModal.action) {
            await confirmModal.action();
          }
          setConfirmModal({ ...confirmModal, isOpen: false });
        }}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />

      {/* Extend Modal */}
      {extendModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100 mb-2">Extend License Duration</h3>
            <p className="text-xs text-slate-400 mb-4">
              Extend expiry for {extendModal.license?.prefix}...{extendModal.license?.last4}
            </p>
            <form onSubmit={handleExtendSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Additional Days
                </label>
                <input
                  type="number"
                  min="1"
                  max="3650"
                  value={extendModal.days}
                  onChange={(e) => setExtendModal({ ...extendModal, days: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500/50"
                  required
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setExtendModal({ isOpen: false, license: null, days: 30 })}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-md shadow-emerald-500/20"
                >
                  Extend Expiry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
