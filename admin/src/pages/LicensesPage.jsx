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
  Filter,
  Zap,
  FileText,
  UserCheck
} from "lucide-react";
import { api } from "../api/client.js";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { StatsCards } from "../components/StatsCards.jsx";
import { CreateLicenseModal } from "../components/CreateLicenseModal.jsx";
import { ConfirmModal } from "../components/ConfirmModal.jsx";
import DirectSaleModal from "../components/DirectSaleModal.jsx";

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
  const [directSaleModalOpen, setDirectSaleModalOpen] = useState(false);
  const [handoverModalLicenseId, setHandoverModalLicenseId] = useState(null);
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
          <h2 className="text-xl font-bold text-zinc-100 tracking-tight">License Management</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Quản lý, cấp phát và thu hồi key bản quyền Auto Rejoin Pro
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDirectSaleModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold rounded-lg text-xs shadow-lg shadow-emerald-500/20 transition"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Bán Key Nhanh (Giao Khách)</span>
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold rounded-lg text-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tạo Key Tùy Biến</span>
          </button>
        </div>
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
      <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 flex flex-col md:flex-row items-center gap-2.5">
        <div className="relative flex-1 w-full">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm theo key, tên khách hàng, số điện thoại, ghi chú..."
            className="w-full pl-9 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-200 placeholder-zinc-600 text-xs focus:outline-none focus:border-zinc-700"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-300 text-xs focus:outline-none focus:border-zinc-700 capitalize"
          >
            <option value="">Tất cả trạng thái</option>
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
            className="px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-300 text-xs focus:outline-none focus:border-zinc-700 capitalize"
          >
            <option value="">Tất cả gói</option>
            {plans.map((p) => (
              <option key={p.plan} value={p.plan}>
                {p.plan}
              </option>
            ))}
          </select>

          <button
            onClick={loadData}
            title="Tải lại"
            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md transition-colors shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden">
        {error ? (
          <div className="p-6 text-center text-rose-400 text-xs flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        ) : licenses.length === 0 && !loading ? (
          <div className="p-10 text-center text-zinc-500">
            <Key className="w-8 h-8 mx-auto mb-2 text-zinc-600 opacity-60" />
            <p className="text-sm font-medium text-zinc-400">Không tìm thấy license nào</p>
            <p className="text-xs text-zinc-500 mt-0.5">Thử điều chỉnh bộ lọc hoặc bấm "Bán Key Nhanh".</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-950/80 border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="py-3 px-4 font-semibold">License Key / Khách hàng</th>
                  <th className="py-3 px-4 font-semibold">Gói cước</th>
                  <th className="py-3 px-4 font-semibold">Trạng thái</th>
                  <th className="py-3 px-4 font-semibold">Thiết bị</th>
                  <th className="py-3 px-4 font-semibold">Hết hạn</th>
                  <th className="py-3 px-4 font-semibold">Ngày tạo</th>
                  <th className="py-3 px-4 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {licenses.map((lic) => (
                  <tr key={lic.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          {lic.displayKey}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">#{lic.id}</span>
                      </div>
                      {lic.customerName && (
                        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-300">
                          <span className="font-semibold text-cyan-300">👤 {lic.customerName}</span>
                          {lic.customerContact && (
                            <span className="text-[10px] text-slate-400">({lic.customerContact})</span>
                          )}
                          {lic.salesChannel && (
                            <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
                              {lic.salesChannel}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-zinc-800 text-zinc-200 border border-zinc-700">
                        {lic.plan}
                      </span>
                      <span className="text-[10px] text-zinc-500 block mt-0.5">
                        {lic.maxInstances} clone
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={lic.status} />
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-zinc-200">
                        {lic.activeDeviceCount} / {lic.maxDevices}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-zinc-400">
                      {formatDate(lic.expiresAt)}
                    </td>
                    <td className="py-3 px-4 text-xs text-zinc-500">
                      {formatDate(lic.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setHandoverModalLicenseId(lic.id)}
                          title="Lấy mẫu bàn giao gửi khách"
                          className="p-1.5 text-cyan-400 hover:text-cyan-200 hover:bg-cyan-500/10 rounded transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onSelectLicense(lic.id)}
                          title="Chi tiết thiết bị"
                          className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setExtendModal({ isOpen: true, license: lic, days: 30 })}
                          title="Gia hạn"
                          className="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 rounded transition-colors"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                        </button>
                        {lic.status === "active" ? (
                          <button
                            onClick={() => handleSuspend(lic)}
                            title="Tạm ngưng"
                            className="p-1.5 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 rounded transition-colors"
                          >
                            <Pause className="w-3.5 h-3.5" />
                          </button>
                        ) : lic.status === "suspended" ? (
                          <button
                            onClick={() => handleReactivate(lic)}
                            title="Kích hoạt lại"
                            className="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 rounded transition-colors"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                        {lic.status !== "revoked" && (
                          <button
                            onClick={() => handleRevoke(lic)}
                            title="Thu hồi vĩnh viễn"
                            className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 rounded transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" />
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
        <div className="px-4 py-3 bg-zinc-950/60 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
          <div>
            Hiển thị <span className="font-semibold text-zinc-200">{licenses.length}</span> trên{" "}
            <span className="font-semibold text-zinc-200">{totalItems}</span> license
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-zinc-800 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span>
              Trang <span className="font-semibold text-zinc-200">{page}</span> / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-zinc-800 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
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

      {/* Direct Sale & Handover Modal */}
      <DirectSaleModal
        isOpen={directSaleModalOpen || Boolean(handoverModalLicenseId)}
        initialLicenseId={handoverModalLicenseId}
        onClose={() => {
          setDirectSaleModalOpen(false);
          setHandoverModalLicenseId(null);
        }}
        onSuccess={() => loadData()}
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
          <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-zinc-100 mb-1">Gia Hạn Thời Gian License</h3>
            <p className="text-xs text-zinc-400 mb-3">
              Gia hạn cho license {extendModal.license?.prefix}...{extendModal.license?.last4}
            </p>
            <form onSubmit={handleExtendSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Số ngày gia hạn thêm
                </label>
                <input
                  type="number"
                  min="1"
                  max="3650"
                  value={extendModal.days}
                  onChange={(e) => setExtendModal({ ...extendModal, days: e.target.value })}
                  className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 text-xs focus:outline-none focus:border-zinc-700"
                  required
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setExtendModal({ isOpen: false, license: null, days: 30 })}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800 rounded-md"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-semibold text-zinc-950 bg-emerald-500 hover:bg-emerald-400 rounded-md transition-colors"
                >
                  Xác nhận gia hạn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
