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
  Zap
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
        api.listLicenses({ limit: 5 }).catch(() => ({ items: [] })),
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
    <div className="space-y-6 text-zinc-200">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800/80">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span>Tổng quan hệ thống</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Quản lý doanh thu, xác thực đơn hàng VietQR và danh sách license.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowDirectSaleModal(true)}
            className="h-9 px-3.5 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Bán Key Nhanh (Giao Khách)</span>
          </button>

          {onNavigateToPayOS && (
            <button
              onClick={onNavigateToPayOS}
              className="h-9 px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-semibold text-emerald-400 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Quản lý PayOS</span>
            </button>
          )}

          <button
            onClick={handleOpenCleanupIncomplete}
            className="h-9 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-semibold text-rose-300 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Dọn dẹp đơn rác chưa thanh toán"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Dọn đơn rác</span>
          </button>

          <button
            onClick={() => setShowSettingsModal(true)}
            className="h-9 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-300 transition-colors flex items-center gap-1.5"
          >
            <Settings className="w-3.5 h-3.5 text-zinc-400" />
            <span>Cấu hình shop</span>
          </button>

          <button
            onClick={() => setShowBatchModal(true)}
            className="h-9 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Tạo key hàng loạt</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-lg bg-zinc-900/40 border border-zinc-800/80 space-y-1">
          <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Doanh thu thực nhận</span>
          <div className="text-xl font-bold text-emerald-400 tracking-tight font-mono">{actualRevenue}</div>
        </div>

        <div className="p-4 rounded-lg bg-zinc-900/40 border border-zinc-800/80 space-y-1">
          <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Key hoạt động</span>
          <div className="text-xl font-bold text-white tracking-tight font-mono">
            {activeLicenses} <span className="text-xs font-normal text-zinc-500">/ {totalLicenses}</span>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-zinc-900/40 border border-zinc-800/80 space-y-1">
          <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Thiết bị đang treo</span>
          <div className="text-xl font-bold text-white tracking-tight font-mono">{activeDevices}</div>
        </div>

        <div className="p-4 rounded-lg bg-zinc-900/40 border border-zinc-800/80 space-y-1">
          <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Sắp hết hạn (&lt; 7 ngày)</span>
          <div className="text-xl font-bold text-amber-400 tracking-tight font-mono">{expiringSoon}</div>
        </div>
      </div>

      {/* Plan Distribution & Recent Keys Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Plan Distribution */}
        <div className="p-4 rounded-lg bg-zinc-900/40 border border-zinc-800/80 space-y-3">
          <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
            Thống kê đơn hàng
          </h3>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 bg-black/40 rounded border border-zinc-800/60 flex items-center justify-between">
              <span className="font-medium text-zinc-300">Đơn đã thanh toán</span>
              <span className="font-semibold text-emerald-400 font-mono">{revenueStats?.totalPaidOrders || 0}</span>
            </div>

            <div className="p-2.5 bg-black/40 rounded border border-zinc-800/60 flex items-center justify-between">
              <span className="font-medium text-zinc-300">Đang chờ thanh toán</span>
              <span className="font-semibold text-amber-400 font-mono">{revenueStats?.totalPendingOrders || 0}</span>
            </div>

            <div className="p-2.5 bg-black/40 rounded border border-zinc-800/60 flex items-center justify-between">
              <span className="font-medium text-zinc-300">Tổng số License cấp</span>
              <span className="font-semibold text-white font-mono">{totalLicenses}</span>
            </div>
          </div>
        </div>

        {/* Right: Recent Licenses Table */}
        <div className="lg:col-span-2 p-4 rounded-lg bg-zinc-900/40 border border-zinc-800/80 space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
              License mới tạo
            </h3>
            <button
              onClick={onNavigateToLicenses}
              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Xem tất cả &rarr;
            </button>
          </div>

          <div className="space-y-1.5 flex-1">
            {licenses.length > 0 ? (
              licenses.map((lic) => (
                <div
                  key={lic.id}
                  onClick={() => onSelectLicense(lic.id)}
                  className="p-2.5 bg-black/40 hover:bg-zinc-800/50 border border-zinc-800/60 rounded flex items-center justify-between cursor-pointer transition-colors text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-medium text-white">{lic.displayKey}</span>
                    <span className="px-1.5 py-0.2 bg-zinc-800 text-zinc-400 text-[10px] font-mono uppercase rounded">
                      {lic.plan}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500 text-[11px]">
                      {lic.activeDeviceCount} / {lic.maxDevices} máy
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        lic.status === "active"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}
                    >
                      {lic.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-xs text-zinc-500">Chưa có license nào.</div>
            )}
          </div>
        </div>
      </div>

      {/* Real-time Payments & Order Transactions */}
      <div className="p-4 rounded-lg bg-zinc-900/40 border border-zinc-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-zinc-400" />
            <span>Lịch sử đơn hàng & Giao dịch thanh toán</span>
          </h3>
          <button
            onClick={fetchDashboardData}
            title="Làm mới"
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {payments.length === 0 ? (
          <div className="p-6 text-center text-xs text-zinc-500 bg-black/30 rounded border border-zinc-800/60">
            Chưa có giao dịch thanh toán nào.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-black/50 text-zinc-500 text-[11px] uppercase tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="py-2 px-3 font-medium">Mã đơn</th>
                  <th className="py-2 px-3 font-medium">Nội dung CK</th>
                  <th className="py-2 px-3 font-medium">Gói cước</th>
                  <th className="py-2 px-3 font-medium">Số tiền</th>
                  <th className="py-2 px-3 font-medium">Trạng thái</th>
                  <th className="py-2 px-3 font-medium">License Key</th>
                  <th className="py-2 px-3 font-medium">Thời gian</th>
                  <th className="py-2 px-3 font-medium text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-2 px-3 font-mono font-medium text-white">{p.payment_code}</td>
                    <td className="py-2 px-3 font-mono text-emerald-400 font-semibold select-all">
                      {p.transfer_content}
                    </td>
                    <td className="py-2 px-3 text-zinc-300">{p.plan_name}</td>
                    <td className="py-2 px-3 font-mono font-medium text-emerald-400">
                      {Number(p.expected_amount).toLocaleString("vi-VN")} đ
                    </td>
                    <td className="py-2 px-3">
                      {p.status === "paid" ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Đã thanh toán
                        </span>
                      ) : p.status === "cancelled" ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 inline-flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          Đã hủy
                        </span>
                      ) : p.status === "expired" ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
                          Hết hạn
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Chờ thanh toán
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono text-zinc-400 select-all">
                      {p.license_id ? `#${p.license_id}` : "—"}
                    </td>
                    <td className="py-2 px-3 text-zinc-500 text-[11px]">
                      {new Date(p.created_at).toLocaleString("vi-VN")}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {p.status === "pending" && (
                          <>
                            <button
                              onClick={() => handleOpenManualVerify(p)}
                              className="px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold transition-colors cursor-pointer"
                            >
                              Duyệt đơn
                            </button>
                            <button
                              onClick={() => handleOpenCancelPayment(p)}
                              className="px-2 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[11px] font-semibold transition-colors cursor-pointer"
                            >
                              Hủy
                            </button>
                          </>
                        )}
                        {p.status !== "paid" && (
                          <button
                            onClick={() => handleOpenDeletePayment(p)}
                            className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
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
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-bottom-5 duration-200 ${
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
