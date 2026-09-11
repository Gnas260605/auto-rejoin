import React, { useState, useEffect } from "react";
import {
  CreditCard,
  Key,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Copy,
  Check,
  Eye,
  EyeOff,
  Trash2,
  CheckSquare,
  Ban,
  ExternalLink,
  Sparkles,
  Search,
  Filter,
  Sliders,
  Send
} from "lucide-react";
import { api } from "../api/client.js";

import { ConfirmActionModal } from "../components/ConfirmActionModal.jsx";

export function PayOSManagementPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);

  // PayOS Config state
  const [config, setConfig] = useState({
    clientId: "",
    apiKey: "",
    checksumKey: "",
    enabled: true,
    gatewayMode: "payos",
    webhookUrl: ""
  });

  const [showApiKey, setShowApiKey] = useState(false);
  const [showChecksum, setShowChecksum] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Payments & Stats
  const [payments, setPayments] = useState([]);
  const [totalPayments, setTotalPayments] = useState(0);
  const [revenueStats, setRevenueStats] = useState({
    totalRevenue: 0,
    totalPaidOrders: 0,
    totalPendingOrders: 0,
    totalCancelledOrders: 0
  });

  // Table filter & search
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);

  // Copy states
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  const defaultWebhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/v1/payments/payos/webhook`
    : "http://localhost:3000/api/v1/payments/payos/webhook";

  const showToast = (msg, type = "success") => {
    setToastMessage({ text: msg, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [cfgRes, revRes, paymentsRes] = await Promise.all([
        api.getPayOSConfig().catch(() => ({ config: {} })),
        api.getRevenueStats().catch(() => ({ stats: {} })),
        api.listAdminPayments({
          page,
          limit: 15,
          status: statusFilter === "all" ? "" : statusFilter,
          search: searchTerm
        }).catch(() => ({ items: [], total: 0 }))
      ]);

      const loadedCfg = cfgRes?.config || {};
      setConfig({
        clientId: loadedCfg.clientId || "",
        apiKey: loadedCfg.apiKey || "",
        checksumKey: loadedCfg.checksumKey || "",
        enabled: loadedCfg.enabled !== undefined ? loadedCfg.enabled : true,
        gatewayMode: loadedCfg.gatewayMode || "payos",
        webhookUrl: loadedCfg.webhookUrl || defaultWebhookUrl
      });

      setRevenueStats(revRes?.stats || {
        totalRevenue: 0,
        totalPaidOrders: 0,
        totalPendingOrders: 0,
        totalCancelledOrders: 0
      });

      setPayments(paymentsRes?.items || []);
      setTotalPayments(paymentsRes?.total || 0);
    } catch (err) {
      showToast(err.message || "Không thể tải dữ liệu PayOS", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const handleSaveConfig = async (e) => {
    e?.preventDefault();
    try {
      setSaving(true);
      await api.savePayOSConfig(config);
      showToast("Cập nhật cấu hình PayOS thành công!");
    } catch (err) {
      showToast(err.message || "Lỗi lưu cấu hình", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const res = await api.testPayOS(config);
      setTestResult({
        ok: true,
        message: res.message || "Cổng PayOS kết nối bình thường, HMAC SHA256 hợp lệ!"
      });
      showToast("Kiểm tra kết nối thành công!");
    } catch (err) {
      setTestResult({
        ok: false,
        message: err.message || "Kiểm tra thất bại. Vui lòng xem lại thông tin API."
      });
      showToast(err.message || "Kiểm tra thất bại", "error");
    } finally {
      setTesting(false);
    }
  };

  // Open Form Confirm Cleanup
  const handleOpenCleanupModal = () => {
    setConfirmModal({
      title: "Dọn dẹp đơn hàng chưa hoàn thành",
      description: "Hệ thống sẽ xóa toàn bộ các đơn hàng chưa thanh toán, hết hạn hoặc bị hủy để làm sạch dữ liệu. Các đơn đã thanh toán thành công và License Key được bảo toàn tuyệt đối.",
      confirmText: "Dọn dẹp ngay",
      variant: "warning",
      details: {
        "Đơn chờ thanh toán": revenueStats.totalPendingOrders || 0,
        "Đơn đã hủy / Hết hạn": revenueStats.totalCancelledOrders || 0,
        "An toàn License Key": "100% Không bị ảnh hưởng"
      },
      action: async () => {
        setModalLoading(true);
        try {
          const res = await api.cleanupIncompletePayments();
          showToast(res.message || "Đã dọn dẹp các đơn chưa hoàn thành!");
          setConfirmModal(null);
          await loadData();
        } catch (err) {
          showToast(err.message || "Dọn dẹp thất bại", "error");
        } finally {
          setModalLoading(false);
        }
      }
    });
  };

  // Open Form Confirm Manual Verify
  const handleOpenManualVerify = (payment) => {
    setConfirmModal({
      title: "Xác nhận duyệt đơn thủ công",
      description: "Hệ thống sẽ ghi nhận thanh toán thành công và lập tức khởi tạo, cấp phát License Key cho đơn hàng này.",
      confirmText: "Duyệt & Cấp Key",
      variant: "success",
      details: {
        "Mã đơn hàng": payment.payment_code,
        "Nội dung CK": payment.transfer_content,
        "Gói cước": payment.plan_name || payment.plan_id,
        "Số tiền": `${Number(payment.expected_amount).toLocaleString("vi-VN")} đ`
      },
      action: async () => {
        setModalLoading(true);
        try {
          await api.manualVerifyPayment(payment.id);
          showToast(`Đã duyệt đơn ${payment.payment_code} và cấp Key thành công!`);
          setConfirmModal(null);
          await loadData();
        } catch (err) {
          showToast(`Duyệt thất bại: ${err.message}`, "error");
        } finally {
          setModalLoading(false);
        }
      }
    });
  };

  // Open Form Confirm Cancel Payment
  const handleOpenCancelPayment = (payment) => {
    setConfirmModal({
      title: "Xác nhận hủy đơn hàng",
      description: "Đơn hàng này sẽ chuyển sang trạng thái ĐÃ HỦY và bị loại bỏ. Khách hàng sẽ không thể thanh toán tiếp cho mã này.",
      confirmText: "Hủy bỏ đơn",
      variant: "danger",
      details: {
        "Mã đơn hàng": payment.payment_code,
        "Nội dung CK": payment.transfer_content,
        "Số tiền": `${Number(payment.expected_amount).toLocaleString("vi-VN")} đ`
      },
      action: async () => {
        setModalLoading(true);
        try {
          await api.cancelAdminPayment(payment.payment_code);
          showToast(`Đã hủy đơn ${payment.payment_code}`);
          setConfirmModal(null);
          await loadData();
        } catch (err) {
          showToast(`Hủy thất bại: ${err.message}`, "error");
        } finally {
          setModalLoading(false);
        }
      }
    });
  };

  // Open Form Confirm Delete Payment
  const handleOpenDeletePayment = (payment) => {
    setConfirmModal({
      title: "Xác nhận xóa vĩnh viễn đơn hàng",
      description: "Bản ghi đơn hàng này sẽ bị xóa hoàn toàn khỏi cơ sở dữ liệu. Thao tác này không thể hoàn tác.",
      confirmText: "Xóa vĩnh viễn",
      variant: "danger",
      details: {
        "Mã đơn hàng": payment.payment_code,
        "Trạng thái hiện tại": payment.status
      },
      action: async () => {
        setModalLoading(true);
        try {
          await api.deletePayment(payment.id);
          showToast(`Đã xóa đơn ${payment.payment_code}`);
          setConfirmModal(null);
          await loadData();
        } catch (err) {
          showToast(`Xóa thất bại: ${err.message}`, "error");
        } finally {
          setModalLoading(false);
        }
      }
    });
  };

  const copyToClipboard = (text, keyId = null) => {
    if (!text) return;
    navigator.clipboard.writeText(String(text));
    if (keyId) {
      setCopiedKey(keyId);
      setTimeout(() => setCopiedKey(null), 2000);
    } else {
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    }
  };

  return (
    <div className="space-y-6 text-slate-200">
      {/* Toast alert */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-bottom-5 duration-200 ${
            toastMessage.type === "error"
              ? "bg-rose-950/90 border-rose-500/50 text-rose-200"
              : "bg-emerald-950/90 border-emerald-500/50 text-emerald-200"
          }`}
        >
          {toastMessage.type === "error" ? <AlertTriangle className="w-4 h-4 text-rose-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2.5">
            <CreditCard className="w-5 h-5 text-emerald-400" />
            <span>Cổng Thanh Toán PayOS & VietQR</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Cấu hình Open Banking VietQR, tự động hủy & dọn dẹp đơn hàng chưa hoàn tất và cấp License Key an toàn.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenCleanupModal}
            className="h-9 px-3.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-semibold text-rose-300 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Xóa tất cả đơn pending/hết hạn chưa thanh toán để giải phóng bộ nhớ"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Dọn dẹp đơn chưa hoàn thành</span>
          </button>

          <button
            onClick={loadData}
            disabled={loading}
            className="h-9 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-400" : "text-slate-400"}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Doanh thu thực nhận</span>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="text-xl font-mono font-bold text-emerald-400">
            {Number(revenueStats.totalRevenue || 0).toLocaleString("vi-VN")} đ
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            {revenueStats.totalPaidOrders || 0} đơn đã thanh toán
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Đơn chờ thanh toán</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-mono font-bold text-amber-400">
            {revenueStats.totalPendingOrders || 0}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">Đang chờ quét VietQR</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Đơn đã hủy / Bỏ dở</span>
            <Ban className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-mono font-bold text-rose-400">
            {revenueStats.totalCancelledOrders || 0}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">Không chiếm dụng key</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Trạng thái Gateway</span>
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-sm font-bold text-slate-200 mt-1 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${config.enabled ? "bg-emerald-400" : "bg-zinc-500"}`} />
            <span>{config.enabled ? "PayOS Đang Bật" : "Tạm Tắt"}</span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono uppercase">
            Mode: {config.gatewayMode}
          </div>
        </div>
      </div>

      {/* Main 2-Column: Configuration & Safety Mechanism */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Col 1 & 2: PayOS API Settings Form */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900/50 border border-slate-800/90 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span>Cấu hình tích hợp PayOS Open Banking</span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Lấy thông tin tại bảng điều khiển nhà phát triển <a href="https://payos.vn" target="_blank" rel="noreferrer" className="text-emerald-400 underline hover:text-emerald-300">PayOS.vn</a>.
              </p>
            </div>

            {/* Gateway Active Switch */}
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 shadow-sm shrink-0">
              <span className="text-xs font-semibold text-slate-300 select-none">
                {config.enabled ? "Bật cổng" : "Tắt cổng"}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={config.enabled}
                onClick={() => setConfig({ ...config, enabled: !config.enabled })}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  config.enabled ? "bg-emerald-500" : "bg-slate-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    config.enabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Client ID */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold flex items-center justify-between">
                  <span>Client ID</span>
                  <span className="text-[10px] text-slate-500 font-normal">PayOS Dev</span>
                </label>
                <input
                  type="text"
                  value={config.clientId}
                  onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
                  placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                />
              </div>

              {/* Gateway Mode */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold">Chế độ vận hành</label>
                <select
                  value={config.gatewayMode}
                  onChange={(e) => setConfig({ ...config, gatewayMode: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-emerald-500 text-xs"
                >
                  <option value="payos">PayOS Tự Động (Open Banking Webhook)</option>
                  <option value="vietqr_direct">VietQR Trực Tiếp (Static Napas)</option>
                  <option value="hybrid">Hybrid (PayOS + VietQR Auto Match)</option>
                </select>
              </div>
            </div>

            {/* API Key */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">API Key</label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={config.apiKey}
                  onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                  placeholder="Nhập API Key từ PayOS"
                  className="w-full px-3 py-2 pr-10 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Checksum Key */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Checksum Key (HMAC SHA256 Signature)</label>
              <div className="relative">
                <input
                  type={showChecksum ? "text" : "password"}
                  value={config.checksumKey}
                  onChange={(e) => setConfig({ ...config, checksumKey: e.target.value })}
                  placeholder="Nhập Checksum Key để xác thực chữ ký Webhook"
                  className="w-full px-3 py-2 pr-10 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowChecksum(!showChecksum)}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showChecksum ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Webhook Endpoint Box with 1-Click Copy */}
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-950 border border-emerald-500/30">
              <div className="flex items-center justify-between">
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" />
                  Webhook URL nhận thông báo biến động số dư:
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(config.webhookUrl || defaultWebhookUrl)}
                  className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold"
                >
                  {copiedWebhook ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedWebhook ? "Đã chép URL" : "Sao chép Webhook URL"}</span>
                </button>
              </div>
              <div className="p-2 rounded bg-black/60 border border-slate-800 font-mono text-[11px] text-slate-300 break-all select-all">
                {config.webhookUrl || defaultWebhookUrl}
              </div>
              <p className="text-[10px] text-slate-500">
                👉 Copy URL này dán vào mục <b>Webhook URL</b> trong Dashboard PayOS để nhận callback tự động khi người dùng chuyển tiền.
              </p>
            </div>

            {/* Test connection result banner */}
            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
                  testResult.ok
                    ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                    : "bg-rose-950/40 border-rose-500/40 text-rose-300"
                }`}
              >
                {testResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />}
                <span>{testResult.message}</span>
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="h-9 px-3.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>{testing ? "Đang kiểm tra..." : "Test Chữ Ký & Kết Nối"}</span>
              </button>

              <button
                type="submit"
                disabled={saving}
                className="h-9 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>{saving ? "Đang lưu..." : "Lưu Cấu Hình PayOS"}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Col 3: Key Integrity & Maintenance Info */}
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/90 space-y-4 flex flex-col justify-between">
          <div className="space-y-3.5">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Cơ chế quản lý License Key an toàn</span>
            </h2>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/90 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Key chỉ sinh ra khi đã nhận đủ tiền</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Khi người dùng chọn gói và mở mã QR, hệ thống chỉ tạo một bản ghi hóa đơn tạm thời (status: <code>pending</code>). <b>Tuyệt đối không</b> giữ trước hay sinh trước License Key.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/90 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-rose-400 font-semibold text-[11px]">
                <Ban className="w-3.5 h-3.5 shrink-0" />
                <span>Bỏ dở & Hủy đơn tự động</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Nếu người mua đóng tab, tắt pop-up hoặc quá 20 phút không chuyển khoản, đơn sẽ chuyển sang <code>cancelled</code> / <code>expired</code> và được tự động loại bỏ.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/90 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-cyan-400 font-semibold text-[11px]">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>Bảo toàn số lượng License</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Không lo spam đơn ảo làm cạn kiệt key. Bạn có thể nhấn nút dọn dẹp bất kỳ lúc nào để dọn sạch các đơn rác.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80">
            <button
              onClick={handleOpenCleanupModal}
              className="w-full py-2.5 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Dọn dẹp tất cả đơn chưa hoàn thành</span>
            </button>
          </div>
        </div>
      </div>

      {/* Transactions & Orders Table */}
      <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/90 space-y-4">
        {/* Table Filters Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <span>Lịch sử đơn hàng & Giao dịch PayOS</span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Tổng cộng {totalPayments} bản ghi giao dịch
            </p>
          </div>

          {/* Search & Status Filter */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Status Tabs */}
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
              {[
                { id: "all", label: "Tất cả" },
                { id: "paid", label: "Đã thanh toán" },
                { id: "pending", label: "Chờ thanh toán" },
                { id: "cancelled", label: "Đã hủy" },
                { id: "expired", label: "Hết hạn" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setStatusFilter(tab.id);
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    statusFilter === tab.id
                      ? "bg-emerald-500/20 text-emerald-300 font-semibold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Box */}
            <form onSubmit={handleSearch} className="flex items-center gap-1">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Mã đơn / Nội dung CK / User..."
                  className="h-8 pl-7 pr-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-600 text-xs focus:outline-none focus:border-emerald-500 w-44 sm:w-56"
                />
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              </div>
              <button
                type="submit"
                className="h-8 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold"
              >
                Tìm
              </button>
            </form>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto rounded-xl border border-slate-800/80">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-mono text-[11px]">
                <th className="p-3">MÃ ĐƠN</th>
                <th className="p-3">NỘI DUNG CK</th>
                <th className="p-3">GÓI CƯỚC</th>
                <th className="p-3">SỐ TIỀN</th>
                <th className="p-3">TRẠNG THÁI</th>
                <th className="p-3">LICENSE KEY</th>
                <th className="p-3">CỔNG</th>
                <th className="p-3">THỜI GIAN</th>
                <th className="p-3 text-right">THAO TÁC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-slate-500">
                    <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Đang tải danh sách giao dịch...</span>
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-slate-500">
                    Không có đơn hàng nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                payments.map((p) => {
                  const isPaid = p.status === "paid";
                  const isPending = p.status === "pending";
                  const isCancelled = p.status === "cancelled";
                  const isExpired = p.status === "expired";

                  return (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Payment Code */}
                      <td className="p-3 font-mono font-bold text-slate-200">
                        {p.payment_code}
                      </td>

                      {/* Transfer Content */}
                      <td className="p-3 font-mono font-semibold text-emerald-400">
                        {p.transfer_content}
                      </td>

                      {/* Plan */}
                      <td className="p-3 font-medium text-slate-300">
                        {p.plan_name || p.plan_id}
                      </td>

                      {/* Expected / Paid Amount */}
                      <td className="p-3 font-mono font-bold text-slate-100">
                        {Number(p.paid_amount || p.expected_amount || 0).toLocaleString("vi-VN")} đ
                      </td>

                      {/* Status Badge */}
                      <td className="p-3">
                        {isPaid && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" />
                            Đã thanh toán
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <Clock className="w-3 h-3" />
                            Chờ thanh toán
                          </span>
                        )}
                        {isCancelled && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            <XCircle className="w-3 h-3" />
                            Đã hủy
                          </span>
                        )}
                        {isExpired && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-500/10 text-zinc-400 border border-zinc-500/30">
                            <Clock className="w-3 h-3" />
                            Hết hạn
                          </span>
                        )}
                      </td>

                      {/* License Key */}
                      <td className="p-3 font-mono">
                        {p.issued_raw_key ? (
                          <button
                            onClick={() => copyToClipboard(p.issued_raw_key, p.id)}
                            className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-xs group"
                            title="Click để sao chép key"
                          >
                            <span>{p.issued_raw_key.slice(0, 12)}...</span>
                            {copiedKey === p.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3 text-slate-500 group-hover:text-emerald-400" />
                            )}
                          </button>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>

                      {/* Provider */}
                      <td className="p-3 font-mono text-[11px] text-slate-400 uppercase">
                        {p.provider || "vietqr"}
                      </td>

                      {/* Time */}
                      <td className="p-3 text-[11px] text-slate-400 font-mono">
                        {new Date(p.created_at).toLocaleDateString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit"
                        })}
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending && (
                            <>
                              <button
                                onClick={() => handleOpenManualVerify(p)}
                                className="px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold transition-colors cursor-pointer"
                              >
                                Duyệt đơn
                              </button>
                              <button
                                onClick={() => handleOpenCancelPayment(p)}
                                className="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[10px] font-bold transition-colors cursor-pointer"
                              >
                                Hủy
                              </button>
                            </>
                          )}

                          {!isPaid && (
                            <button
                              onClick={() => handleOpenDeletePayment(p)}
                              className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Xóa vĩnh viễn đơn rác này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPayments > 15 && (
          <div className="flex items-center justify-between pt-2 text-xs text-slate-400">
            <span>
              Trang {page} / {Math.ceil(totalPayments / 15) || 1}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 bg-slate-950 border border-slate-800 rounded text-slate-300 disabled:opacity-40"
              >
                Trước
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(totalPayments / 15)}
                className="px-3 py-1 bg-slate-950 border border-slate-800 rounded text-slate-300 disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reusable In-App Confirmation Modal */}
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
    </div>
  );
}
