import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  Layers,
  Settings,
  Activity,
  Receipt,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldCheck,
  RefreshCw,
  Trash2,
  CreditCard,
  Zap,
  Key,
  Smartphone,
  AlertCircle,
  ChevronRight,
  ExternalLink,
  Sparkles,
  ArrowUpRight
} from "lucide-react";
import { api } from "../api/client.js";
import { BatchCreateModal } from "../components/BatchCreateModal.jsx";
import { PaymentSettingsModal } from "../components/PaymentSettingsModal.jsx";
import { ConfirmActionModal } from "../components/ConfirmActionModal.jsx";
import DirectSaleModal from "../components/DirectSaleModal.jsx";

export function DashboardStatsPage({ onSelectLicense, onNavigateToLicenses, onNavigateToPayOS }) {
  const [stats, setStats] = useState(null);
  const [revenueStats, setRevenueStats] = useState(null);
  const [licenses, setLicenses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDirectSaleModal, setShowDirectSaleModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg, type = "success") => {
    setToastMessage({ text: msg, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsData, revData, licensesData, paymentsData] = await Promise.all([
        api.getStats().catch(() => null),
        api.getRevenueStats().catch(() => null),
        api.listLicenses({ limit: 6 }).catch(() => ({ items: [] })),
        api.listAdminPayments({ limit: 10 }).catch(() => ({ items: [] }))
      ]);
      setStats(statsData?.stats || null);
      setRevenueStats(revData?.stats || null);
      setLicenses(licensesData.items || []);
      setPayments(paymentsData.items || []);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleOpenManualVerify = (payment) => {
    setConfirmModal({
      title: "Xác nhận duyệt đơn thủ công",
      description: "Hệ thống sẽ ghi nhận thanh toán thành công và lập tức khởi tạo, cấp phát License Key cho đơn hàng này.",
      confirmText: "Duyệt & Cấp Key",
      variant: "success",
      details: {
        "Mã đơn": payment.payment_code,
        "Nội dung CK": payment.transfer_content,
        "Số tiền": `${Number(payment.expected_amount).toLocaleString("vi-VN")} đ`,
        "Gói cước": payment.plan_name
      },
      action: async () => {
        setModalLoading(true);
        try {
          await api.manualVerifyPayment(payment.id);
          showToast(`Đã duyệt đơn ${payment.payment_code} và cấp Key thành công!`);
          setConfirmModal(null);
          await fetchDashboardData();
        } catch (err) {
          showToast(`Duyệt thất bại: ${err.message}`, "error");
        } finally {
          setModalLoading(false);
        }
      }
    });
  };

  const handleOpenCancelPayment = (payment) => {
    setConfirmModal({
      title: "Xác nhận hủy đơn hàng",
      description: "Đơn hàng này sẽ chuyển sang trạng thái ĐÃ HỦY và bị loại bỏ.",
      confirmText: "Hủy bỏ đơn",
      variant: "danger",
      details: {
        "Mã đơn": payment.payment_code,
        "Số tiền": `${Number(payment.expected_amount).toLocaleString("vi-VN")} đ`
      },
      action: async () => {
        setModalLoading(true);
        try {
          await api.cancelAdminPayment(payment.payment_code);
          showToast(`Đã hủy đơn ${payment.payment_code}`);
          setConfirmModal(null);
          await fetchDashboardData();
        } catch (err) {
          showToast(`Hủy thất bại: ${err.message}`, "error");
        } finally {
          setModalLoading(false);
        }
      }
    });
  };

  const handleOpenDeletePayment = (payment) => {
    setConfirmModal({
      title: "Xác nhận xóa vĩnh viễn đơn hàng",
      description: "Đơn hàng này sẽ bị xóa hoàn toàn khỏi cơ sở dữ liệu. Thao tác này không thể hoàn tác.",
      confirmText: "Xóa vĩnh viễn",
      variant: "danger",
      details: {
        "Mã đơn": payment.payment_code
      },
      action: async () => {
        setModalLoading(true);
        try {
          await api.deletePayment(payment.id);
          showToast(`Đã xóa đơn ${payment.payment_code}`);
          setConfirmModal(null);
          await fetchDashboardData();
        } catch (err) {
          showToast(`Xóa thất bại: ${err.message}`, "error");
        } finally {
          setModalLoading(false);
        }
      }
    });
  };

  const handleOpenCleanupIncomplete = () => {
    setConfirmModal({
      title: "Dọn dẹp đơn hàng chưa hoàn thành",
      description: "Hệ thống sẽ xóa toàn bộ các đơn hàng chưa thanh toán, hết hạn hoặc bị hủy để giải phóng dữ liệu. Các đơn đã thanh toán thành công và License Key được bảo toàn tuyệt đối.",
      confirmText: "Dọn dẹp ngay",
      variant: "warning",
      details: {
        "Đơn chờ thanh toán": revenueStats?.totalPendingOrders || 0,
        "Đơn đã hủy / Hết hạn": revenueStats?.totalCancelledOrders || 0
      },
      action: async () => {
        setModalLoading(true);
        try {
          const res = await api.cleanupIncompletePayments();
          showToast(res.message || "Đã dọn dẹp các đơn chưa hoàn thành!");
          setConfirmModal(null);
          await fetchDashboardData();
        } catch (err) {
          showToast(`Dọn dẹp thất bại: ${err.message}`, "error");
        } finally {
          setModalLoading(false);
        }
      }
    });
  };

  const totalLicenses = stats?.total || licenses.length || 0;
  const activeLicenses = stats?.active || licenses.filter((l) => l.status === "active").length || 0;
  const activeDevices = stats?.activeDevices || 0;
  const expiringSoon = stats?.expiringSoon || 0;
  const actualRevenue = (revenueStats?.totalRevenue || 0).toLocaleString("vi-VN") + " đ";

  return (
    <div className="space-y-6 text-slate-200 animate-fadeIn">
      {/* Top Banner / Welcome Card */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-[#0B132B] to-slate-900 border border-slate-800/80 backdrop-blur-xl shadow-2xl">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight font-heading">
                Tổng Quan & Phân Tích Hệ Thống
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Giám sát doanh thu tự động, thiết bị chạy tool thời gian thực và quản lý đơn hàng
              </p>
            </div>
          </div>
        </div>

        {/* Action Hub */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowDirectSaleModal(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 text-xs font-black shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] flex items-center gap-2 cursor-pointer"
          >
            <Zap className="w-4 h-4 fill-slate-950" />
            <span>Bán Key Nhanh (Giao Khách)</span>
          </button>

          {onNavigateToPayOS && (
            <button
              onClick={onNavigateToPayOS}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-xs font-bold text-emerald-300 transition-all flex items-center gap-2 cursor-pointer"
            >
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <span>Cổng PayOS</span>
            </button>
          )}

          <button
            onClick={() => setShowBatchModal(true)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-xs font-bold text-slate-200 transition-all flex items-center gap-2"
          >
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>Tạo Key Sỉ</span>
          </button>

          <button
            onClick={handleOpenCleanupIncomplete}
            className="px-3.5 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-bold text-rose-300 transition-all flex items-center gap-2 cursor-pointer"
            title="Dọn dẹp đơn rác chưa thanh toán"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>Dọn Đơn Rác</span>
          </button>

          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-400 hover:text-white transition-colors"
            title="Cấu hình Shop & Thanh toán"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-slate-800/80 shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Doanh Thu Thực Nhận
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono tracking-tight mt-1">
            {actualRevenue}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{revenueStats?.totalPaidOrders || 0} giao dịch thành công</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-slate-800/80 shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Key Đang Hoạt Động
            </span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Key className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white font-mono tracking-tight mt-1 flex items-baseline gap-1.5">
            <span>{activeLicenses}</span>
            <span className="text-xs font-normal text-slate-400">/ {totalLicenses} tổng key</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 mt-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              {totalLicenses > 0 ? Math.round((activeLicenses / totalLicenses) * 100) : 0}% tỷ lệ kích hoạt
            </span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-slate-800/80 shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Thiết Bị Cắm Tool (HWID)
            </span>
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Smartphone className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white font-mono tracking-tight mt-1">
            {activeDevices}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-2">
            <Activity className="w-3.5 h-3.5 text-teal-400" />
            <span>Máy ảo / Termux đang online</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-slate-800/80 shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Sắp Hết Hạn (&lt; 7 Ngày)
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono tracking-tight mt-1">
            {expiringSoon}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Cần chăm sóc & gia hạn khách</span>
          </div>
        </div>
      </div>

      {/* Plan Distribution & Recent Keys Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Order & License Summary */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-4 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-400" />
              <span>Thống Kê Đơn Hàng</span>
            </h3>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 flex items-center justify-between">
              <span className="font-semibold text-slate-300">Đơn đã thanh toán</span>
              <span className="font-black text-emerald-400 font-mono text-sm">
                {revenueStats?.totalPaidOrders || 0}
              </span>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 flex items-center justify-between">
              <span className="font-semibold text-slate-300">Đang chờ thanh toán</span>
              <span className="font-black text-amber-400 font-mono text-sm">
                {revenueStats?.totalPendingOrders || 0}
              </span>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 flex items-center justify-between">
              <span className="font-semibold text-slate-300">Đơn đã hủy / Hết hạn</span>
              <span className="font-black text-slate-400 font-mono text-sm">
                {revenueStats?.totalCancelledOrders || 0}
              </span>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 flex items-center justify-between">
              <span className="font-semibold text-slate-300">Tổng số License đã cấp</span>
              <span className="font-black text-white font-mono text-sm">{totalLicenses}</span>
            </div>
          </div>
        </div>

        {/* Right: Recent Licenses Stream */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-4 flex flex-col justify-between backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Key className="w-4 h-4 text-cyan-400" />
              <span>License Cấp Gần Đây (Live Feed)</span>
            </h3>
            <button
              onClick={onNavigateToLicenses}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 transition-colors"
            >
              <span>Xem tất cả</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2 flex-1">
            {licenses.length > 0 ? (
              licenses.map((lic) => (
                <div
                  key={lic.id}
                  onClick={() => onSelectLicense(lic.id)}
                  className="p-3 bg-slate-950/70 hover:bg-slate-800/60 border border-slate-800/80 rounded-xl flex items-center justify-between cursor-pointer transition-all text-xs group"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-white group-hover:text-emerald-300 transition-colors">
                      {lic.displayKey}
                    </span>
                    <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] font-mono font-bold uppercase rounded-md border border-slate-700">
                      {lic.plan}
                    </span>
                    {lic.customerName && (
                      <span className="text-[11px] text-cyan-300 font-medium hidden sm:inline-block">
                        👤 {lic.customerName}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 text-[11px] font-medium">
                      {lic.activeDeviceCount} / {lic.maxDevices} máy
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase border ${
                        lic.status === "active"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      }`}
                    >
                      {lic.status}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-colors" />
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">Chưa có license nào.</div>
            )}
          </div>
        </div>
      </div>

      {/* Real-time Payments & Order Transactions */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-4 backdrop-blur-xl shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-400" />
            <span>Lịch Sử Đơn Hàng & Giao Dịch VietQR / PayOS</span>
          </h3>
          <button
            onClick={fetchDashboardData}
            title="Làm mới dữ liệu"
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-400" : ""}`} />
          </button>
        </div>

        {payments.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-slate-950/60 rounded-xl border border-slate-800/80">
            Chưa có giao dịch thanh toán nào.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3 font-bold">Mã Đơn</th>
                  <th className="py-3 px-3 font-bold">Nội Dung CK</th>
                  <th className="py-3 px-3 font-bold">Gói Cước</th>
                  <th className="py-3 px-3 font-bold">Số Tiền</th>
                  <th className="py-3 px-3 font-bold">Trạng Thái</th>
                  <th className="py-3 px-3 font-bold">License ID</th>
                  <th className="py-3 px-3 font-bold">Thời Gian</th>
                  <th className="py-3 px-3 font-bold text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-white">{p.payment_code}</td>
                    <td className="py-3 px-3 font-mono text-emerald-400 font-bold select-all">
                      {p.transfer_content}
                    </td>
                    <td className="py-3 px-3 text-slate-300 font-medium">{p.plan_name}</td>
                    <td className="py-3 px-3 font-mono font-bold text-emerald-400">
                      {Number(p.expected_amount).toLocaleString("vi-VN")} đ
                    </td>
                    <td className="py-3 px-3">
                      {p.status === "paid" ? (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Đã thanh toán
                        </span>
                      ) : p.status === "cancelled" ? (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 inline-flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          Đã hủy
                        </span>
                      ) : p.status === "expired" ? (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                          Hết hạn
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 inline-flex items-center gap-1 animate-pulse">
                          <Clock className="w-3 h-3" />
                          Chờ thanh toán
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-400 select-all">
                      {p.license_id ? `#${p.license_id}` : "—"}
                    </td>
                    <td className="py-3 px-3 text-slate-400 text-[11px] font-mono">
                      {new Date(p.created_at).toLocaleString("vi-VN")}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {p.status === "pending" && (
                          <>
                            <button
                              onClick={() => handleOpenManualVerify(p)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold transition-all cursor-pointer"
                            >
                              Duyệt đơn
                            </button>
                            <button
                              onClick={() => handleOpenCancelPayment(p)}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[11px] font-bold transition-all cursor-pointer"
                            >
                              Hủy
                            </button>
                          </>
                        )}
                        {p.status !== "paid" && (
                          <button
                            onClick={() => handleOpenDeletePayment(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Xóa đơn này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-bold flex items-center gap-2 animate-in slide-in-from-bottom-5 duration-200 backdrop-blur-xl ${
            toastMessage.type === "error"
              ? "bg-rose-950/90 border-rose-500/50 text-rose-200"
              : "bg-emerald-950/90 border-emerald-500/50 text-emerald-200"
          }`}
        >
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Reusable Confirmation Modal */}
      <ConfirmActionModal
        isOpen={Boolean(confirmModal)}
        onClose={() => setConfirmModal(null)}
        onConfirm={confirmModal?.action}
        title={confirmModal?.title}
        description={confirmModal?.description}
        confirmText={confirmModal?.confirmText}
        variant={confirmModal?.variant}
        details={confirmModal?.details}
        loading={modalLoading}
      />

      {/* Modals */}
      <DirectSaleModal
        isOpen={showDirectSaleModal}
        onClose={() => setShowDirectSaleModal(false)}
        onSuccess={fetchDashboardData}
      />
      <BatchCreateModal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        onCreated={fetchDashboardData}
      />
      <PaymentSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </div>
  );
}
