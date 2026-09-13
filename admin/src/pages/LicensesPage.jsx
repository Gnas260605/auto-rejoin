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
  UserCheck,
  Copy,
  Check,
  Smartphone,
  ShieldCheck,
  Sparkles,
  Download,
  RotateCcw,
  Clock,
  Laptop
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

  // Copied states
  const [copiedId, setCopiedId] = useState(null);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [directSaleModalOpen, setDirectSaleModalOpen] = useState(false);
  const [handoverModalLicenseId, setHandoverModalLicenseId] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Xác nhận",
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
      setError(err.message || "Không thể tải danh sách License");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, planFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCopyKey = (keyText, id) => {
    navigator.clipboard.writeText(keyText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCSV = () => {
    if (!licenses || licenses.length === 0) {
      alert("Không có dữ liệu license để xuất");
      return;
    }
    const headers = ["ID", "Key", "KhachHang", "Goi", "TrangThai", "ThietBiSuDung", "ThoiHan", "NgayTao"];
    const rows = licenses.map((l) => [
      l.id,
      l.displayKey || `${l.prefix}...${l.last4}`,
      `"${(l.customerName || "N/A").replace(/"/g, '""')}"`,
      l.plan,
      l.status,
      `${l.activeDeviceCount || 0}/${l.maxDevices || 1}`,
      l.expiresAt ? new Date(l.expiresAt).toLocaleDateString("vi-VN") : "VinhVien",
      new Date(l.createdAt).toLocaleDateString("vi-VN")
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `licenses_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Action handlers with confirmation
  const handleSuspend = (license) => {
    setConfirmModal({
      isOpen: true,
      title: "Tạm ngưng License?",
      message: `Bạn có chắc muốn tạm ngưng license ${license.prefix}...${license.last4}? Các thiết bị đang cắm tool sẽ bị tạm dừng trong lần kiểm tra tiếp theo.`,
      confirmText: "Tạm ngưng",
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
      title: "Kích hoạt lại License?",
      message: `Mở khóa và cho phép license ${license.prefix}...${license.last4} hoạt động trở lại?`,
      confirmText: "Kích hoạt lại",
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
      title: "Thu hồi vĩnh viễn License?",
      message: `Cảnh báo: Hành động này KHÔNG THỂ HOÀN TÁC. License ${license.prefix}...${license.last4} và toàn bộ thiết bị đang kết nối sẽ bị hủy bỏ ngay lập tức.`,
      confirmText: "Thu hồi vĩnh viễn",
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
      alert(`Gia hạn thất bại: ${err.message}`);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return "Vĩnh viễn";
    const d = new Date(isoString);
    return d.toLocaleDateString("vi-VN", { year: "numeric", month: "2-digit", day: "2-digit" });
  };

  const getDaysRemaining = (isoString) => {
    if (!isoString) return { label: "Vĩnh viễn", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" };
    const diff = new Date(isoString).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return { label: "Đã hết hạn", color: "text-rose-400 bg-rose-500/10 border-rose-500/30 font-bold" };
    if (days === 0) return { label: "Hết hạn hôm nay", color: "text-amber-400 bg-amber-500/10 border-amber-500/30 animate-pulse font-bold" };
    if (days <= 3) return { label: `Còn ${days} ngày`, color: "text-amber-400 bg-amber-500/10 border-amber-500/30 font-bold animate-pulse" };
    if (days <= 7) return { label: `Còn ${days} ngày`, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30" };
    return { label: `Còn ${days} ngày`, color: "text-slate-300 bg-slate-800/80 border-slate-700/60" };
  };

  const filterTabs = [
    { id: "", label: "Tất cả", count: stats?.total || 0 },
    { id: "active", label: "Đang hoạt động", count: stats?.active || 0, dot: "bg-emerald-400" },
    { id: "suspended", label: "Tạm ngưng", count: stats?.suspended || 0, dot: "bg-amber-400" },
    { id: "expired", label: "Đã hết hạn", count: stats?.expired || 0, dot: "bg-rose-400" },
    { id: "revoked", label: "Đã thu hồi", count: stats?.revoked || 0, dot: "bg-slate-500" }
  ];

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900/90 via-[#0B132B]/80 to-slate-900/90 p-5 sm:p-6 rounded-3xl border border-slate-800/80 backdrop-blur-xl shadow-xl shadow-black/20">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 shadow-sm">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2 font-heading">
                Quản Lý Bản Quyền License
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Cấp phát nhanh, theo dõi tải thiết bị trực quan, gia hạn và xuất lệnh cài đặt 1 chạm
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={() => setDirectSaleModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-extrabold rounded-xl text-xs shadow-md shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.99]"
          >
            <Zap className="w-4 h-4 fill-slate-950" />
            <span>Bán Key Nhanh (Giao Khách)</span>
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 font-bold rounded-xl text-xs border border-slate-700/80 transition-all"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Tạo Key Tùy Biến</span>
          </button>
          <button
            onClick={handleExportCSV}
            title="Xuất danh sách sang CSV"
            className="p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-700/80 transition-all"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Metrics Header */}
      <StatsCards
        stats={stats}
        activeFilter={statusFilter}
        onFilterChange={(f) => {
          setStatusFilter(f === "expiring" ? "" : f);
          setPage(1);
        }}
      />

      {/* Tab Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {filterTabs.map((tab) => {
          const active = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(1);
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                active
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/10"
                  : "bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-slate-800/60"
              }`}
            >
              {tab.dot && <span className={`w-2 h-2 rounded-full ${tab.dot}`} />}
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  active ? "bg-emerald-500/30 text-emerald-200" : "bg-slate-800 text-slate-400"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter / Search Bar */}
      <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-center gap-3 backdrop-blur-md">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm theo Key, Tên khách hàng, Số điện thoại, Ghi chú..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={planFilter}
            onChange={(e) => {
              setPlanFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-emerald-500 uppercase"
          >
            <option value="">Tất cả gói</option>
            {plans.map((p) => (
              <option key={p.plan} value={p.plan}>
                {p.plan.toUpperCase()}
              </option>
            ))}
          </select>

          <button
            onClick={loadData}
            title="Tải lại dữ liệu"
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 overflow-hidden backdrop-blur-xl shadow-2xl">
        {error ? (
          <div className="p-8 text-center text-rose-400 text-xs flex items-center justify-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        ) : licenses.length === 0 && !loading ? (
          <div className="p-14 text-center text-slate-400">
            <div className="w-14 h-14 mx-auto mb-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center text-slate-500">
              <Key className="w-7 h-7" />
            </div>
            <p className="text-base font-bold text-slate-200 font-heading">Không tìm thấy license nào</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Thử điều chỉnh từ khóa tìm kiếm hoặc bấm nút "Tạo Key" để cấp phát license mới.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/90 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-3.5 px-4 font-bold">Mã License & Khách Hàng</th>
                  <th className="py-3.5 px-4 font-bold">Gói Cước</th>
                  <th className="py-3.5 px-4 font-bold">Trạng Thái</th>
                  <th className="py-3.5 px-4 font-bold">Slot Thiết Bị (HWID)</th>
                  <th className="py-3.5 px-4 font-bold">Thời Hạn & Đếm Ngược</th>
                  <th className="py-3.5 px-4 font-bold">Ngày Cấp</th>
                  <th className="py-3.5 px-4 font-bold text-right">Hành Động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {licenses.map((lic) => {
                  const usagePercent = Math.min(
                    100,
                    Math.round(((lic.activeDeviceCount || 0) / (lic.maxDevices || 1)) * 100)
                  );
                  const isFull = (lic.activeDeviceCount || 0) >= (lic.maxDevices || 1);
                  const expiryInfo = getDaysRemaining(lic.expiresAt);

                  return (
                    <tr key={lic.id} className="hover:bg-slate-800/40 transition-colors group">
                      {/* Column 1: Key & Customer */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/25 tracking-wide shadow-sm">
                            {lic.displayKey}
                          </span>
                          <button
                            type="button"
                            title="Sao chép mã Key"
                            onClick={() => handleCopyKey(lic.prefix + "..." + lic.last4, lic.id)}
                            className="p-1 text-slate-400 hover:text-emerald-400 transition rounded-md hover:bg-slate-800"
                          >
                            {copiedId === lic.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <span className="text-[10px] text-slate-500 font-mono">#{lic.id}</span>
                        </div>

                        {lic.customerName && (
                          <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-300">
                            <span className="font-semibold text-cyan-300">👤 {lic.customerName}</span>
                            {lic.customerContact && (
                              <span className="text-[10px] text-slate-400">({lic.customerContact})</span>
                            )}
                            {lic.salesChannel && (
                              <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                                {lic.salesChannel}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Column 2: Plan */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase bg-slate-800 text-slate-200 border border-slate-700 tracking-wider">
                          {lic.plan}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-1">
                          {lic.maxInstances} instance clone
                        </span>
                      </td>

                      {/* Column 3: Status */}
                      <td className="py-3.5 px-4">
                        <StatusBadge status={lic.status} />
                      </td>

                      {/* Column 4: Device Usage Slots */}
                      <td className="py-3.5 px-4 min-w-[135px]">
                        <div className="flex items-center justify-between text-xs font-semibold mb-1">
                          <span className={isFull ? "text-rose-400 font-bold" : "text-slate-200"}>
                            {lic.activeDeviceCount} / {lic.maxDevices} máy
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{usagePercent}%</span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isFull
                                ? "bg-rose-500"
                                : usagePercent >= 70
                                ? "bg-amber-400"
                                : "bg-emerald-400"
                            }`}
                            style={{ width: `${usagePercent}%` }}
                          />
                        </div>
                      </td>

                      {/* Column 5: Expiration */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] border ${expiryInfo.color}`}
                          >
                            {expiryInfo.label}
                          </span>
                          <span className="block text-[11px] text-slate-400 font-mono">
                            {formatDate(lic.expiresAt)}
                          </span>
                        </div>
                      </td>

                      {/* Column 6: Created Date */}
                      <td className="py-3.5 px-4 text-xs text-slate-400 font-mono">
                        {formatDate(lic.createdAt)}
                      </td>

                      {/* Column 7: Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setHandoverModalLicenseId(lic.id)}
                            title="Lấy mẫu văn bản bàn giao cho khách"
                            className="p-1.5 text-cyan-400 hover:text-cyan-200 hover:bg-cyan-500/15 rounded-lg transition border border-transparent hover:border-cyan-500/20"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onSelectLicense(lic.id)}
                            title="Xem chi tiết thiết bị kết nối"
                            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition border border-transparent hover:border-slate-700"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setExtendModal({ isOpen: true, license: lic, days: 30 })}
                            title="Gia hạn thêm ngày"
                            className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/15 rounded-lg transition border border-transparent hover:border-emerald-500/20"
                          >
                            <Calendar className="w-4 h-4" />
                          </button>
                          {lic.status === "active" ? (
                            <button
                              onClick={() => handleSuspend(lic)}
                              title="Tạm ngưng license"
                              className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-500/15 rounded-lg transition border border-transparent hover:border-amber-500/20"
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                          ) : lic.status === "suspended" ? (
                            <button
                              onClick={() => handleReactivate(lic)}
                              title="Kích hoạt lại license"
                              className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/15 rounded-lg transition border border-transparent hover:border-emerald-500/20"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          ) : null}
                          {lic.status !== "revoked" && (
                            <button
                              onClick={() => handleRevoke(lic)}
                              title="Thu hồi vĩnh viễn"
                              className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/15 rounded-lg transition border border-transparent hover:border-rose-500/20"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="px-5 py-3.5 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Hiển thị <span className="font-bold text-slate-200">{licenses.length}</span> trên{" "}
            <span className="font-bold text-slate-200">{totalItems}</span> license
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2">
              Trang <span className="font-bold text-emerald-400">{page}</span> / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 transition"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1 font-heading">Gia Hạn Thời Gian License</h3>
            <p className="text-xs text-slate-400 mb-4">
              Gia hạn cho license{" "}
              <code className="text-emerald-400 font-mono font-bold">
                {extendModal.license?.prefix}...{extendModal.license?.last4}
              </code>
            </p>
            <form onSubmit={handleExtendSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Số ngày gia hạn thêm
                </label>
                <input
                  type="number"
                  min="1"
                  max="3650"
                  value={extendModal.days}
                  onChange={(e) => setExtendModal({ ...extendModal, days: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-emerald-500 font-mono"
                  required
                />
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setExtendModal({ isOpen: false, license: null, days: 30 })}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition shadow-lg shadow-emerald-500/20"
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
