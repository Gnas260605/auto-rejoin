import React, { useState, useEffect, useCallback } from "react";
import { useCustomerAuth } from "../context/CustomerAuthContext.jsx";
import { customerApi } from "../api/customerClient.js";

function formatVND(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(num);
}

function formatDate(isoStr) {
  if (!isoStr) return "--";
  try {
    const d = new Date(isoStr);
    return d.toLocaleString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  } catch (_e) {
    return isoStr;
  }
}

const TYPE_LABELS = {
  TOPUP: { label: "Nạp tiền", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  PURCHASE: { label: "Thanh toán đơn", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  REFUND: { label: "Hoàn tiền", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  ADJUSTMENT: { label: "Điều chỉnh", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  REWARD: { label: "Phần thưởng", color: "bg-pink-500/20 text-pink-400 border-pink-500/30" }
};

export function CustomerDashboardPage({ onBackToStore }) {
  const { customer, wallet, refreshWallet, logout } = useCustomerAuth();
  
  // Ledger state
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState("");
  const [directionFilter, setDirectionFilter] = useState("");

  const [topupNoticeOpen, setTopupNoticeOpen] = useState(false);

  const fetchTransactions = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await customerApi.getWalletTransactions({
        page,
        limit: 10,
        type: typeFilter || undefined,
        direction: directionFilter || undefined
      });
      if (res.ok) {
        setTransactions(res.transactions || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      }
    } catch (err) {
      setError(err.message || "Không thể tải danh sách giao dịch ví.");
    } finally {
      setLoading(false);
    }
  }, [typeFilter, directionFilter]);

  useEffect(() => {
    refreshWallet();
    fetchTransactions(1);
  }, [fetchTransactions, refreshWallet]);

  return (
    <div className="min-h-screen bg-[#060B14] text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#080D1A]/90 backdrop-blur-md px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToStore}
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 border border-cyan-800/60 px-3 py-1.5 rounded-lg hover:bg-cyan-900/40 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Về Cửa Hàng</span>
            </button>
            <h1 className="text-base font-bold text-white tracking-tight hidden sm:block">
              Bảng Điều Khiển Khách Hàng
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800/60 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300 font-medium">@{customer?.username || "user"}</span>
              <span className="text-slate-500">|</span>
              <span className="text-cyan-400 font-bold">{formatVND(wallet?.balance || 0)}</span>
            </div>

            <button
              onClick={async () => {
                await logout();
                onBackToStore();
              }}
              className="text-xs font-medium text-slate-400 hover:text-rose-400 px-3 py-1.5 rounded-lg hover:bg-slate-800/50 border border-transparent hover:border-rose-900/40 transition-all cursor-pointer"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Customer Welcome & Status Bar */}
        <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-r from-[#0E1A30] via-[#0A1324] to-[#0A1828] p-6 shadow-xl relative overflow-hidden">
          <div className="pointer-events-none absolute -right-16 -top-16 w-64 h-64 rounded-full bg-cyan-500/10 blur-3xl" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                <span className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Xin chào, {customer?.fullName || customer?.username || "Khách Hàng"}!
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {customer?.role || "CUSTOMER"}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                  customer?.status === "ACTIVE"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                }`}>
                  {customer?.status || "ACTIVE"}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Email: <span className="text-slate-300 font-mono">{customer?.email || "--"}</span>
                {customer?.emailVerified ? (
                  <span className="ml-2 text-emerald-400 font-medium">✓ Đã xác thực</span>
                ) : (
                  <span className="ml-2 text-amber-400/90">(Chưa xác thực)</span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setTopupNoticeOpen(true)}
                className="rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-emerald-400 transition-all cursor-pointer flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Nạp Tiền Vào Ví</span>
              </button>
            </div>
          </div>
        </div>

        {/* Balance Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-emerald-500/30 bg-[#0A1624]/90 p-5 shadow-lg relative overflow-hidden">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1 flex items-center justify-between">
              <span>Số Dư Khả Dụng</span>
              <span className="text-emerald-500">💰</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-300 tracking-tight">
              {formatVND(wallet?.balance || 0)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Dùng để thanh toán key, code, túi mù và các dịch vụ tức thì.</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0A1322]/80 p-5 shadow-lg">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
              <span>Số Dư Tạm Giữ</span>
              <span className="text-slate-500">🔒</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-300 tracking-tight">
              {formatVND(wallet?.lockedBalance || 0)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Đang khóa phục vụ đơn hàng hoặc ticket dịch vụ đang xử lý.</p>
          </div>

          <div className="rounded-2xl border border-cyan-500/20 bg-[#081220]/80 p-5 shadow-lg">
            <div className="text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-1 flex items-center justify-between">
              <span>Tổng Tài Sản Ví</span>
              <span className="text-cyan-500">💎</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-cyan-300 tracking-tight">
              {formatVND((wallet?.balance || 0) + (wallet?.lockedBalance || 0))}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Tổng giá trị ví bao gồm khả dụng và tạm giữ.</p>
          </div>
        </div>

        {/* Transaction History Section */}
        <div className="rounded-2xl border border-slate-800/90 bg-[#091122]/95 p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Lịch Sử Biến Động Số Dư (Ledger)</span>
                <span className="text-xs font-normal text-slate-400">({pagination.total} giao dịch)</span>
              </h2>
              <p className="text-xs text-slate-400">Sổ cái kế toán bất biến (Immutable Ledger) ghi nhận chi tiết mọi biến động số dư.</p>
            </div>

            {/* Filter controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:border-cyan-400 focus:outline-none"
              >
                <option value="">Tất cả loại giao dịch</option>
                <option value="TOPUP">Nạp tiền (TOPUP)</option>
                <option value="PURCHASE">Thanh toán đơn (PURCHASE)</option>
                <option value="REFUND">Hoàn tiền (REFUND)</option>
                <option value="ADJUSTMENT">Điều chỉnh (ADJUSTMENT)</option>
                <option value="REWARD">Phần thưởng (REWARD)</option>
              </select>

              <select
                value={directionFilter}
                onChange={(e) => setDirectionFilter(e.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:border-cyan-400 focus:outline-none"
              >
                <option value="">Tất cả chiều</option>
                <option value="CREDIT">Cộng tiền (+ CREDIT)</option>
                <option value="DEBIT">Trừ tiền (- DEBIT)</option>
              </select>

              <button
                onClick={() => fetchTransactions(pagination.page)}
                className="rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
                title="Làm mới sổ cái"
              >
                <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Làm mới</span>
              </button>
            </div>
          </div>

          {/* Table content */}
          {error && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-300 flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={() => fetchTransactions(1)}
                className="underline hover:text-white font-semibold cursor-pointer"
              >
                Thử lại
              </button>
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="w-7 h-7 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-400">Đang truy xuất sổ cái giao dịch...</span>
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-12 text-center rounded-xl border border-slate-800/60 bg-slate-900/30">
              <span className="text-3xl block mb-2">📜</span>
              <p className="text-sm font-semibold text-slate-300">Chưa có biến động số dư nào</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Mọi giao dịch nạp tiền, hoàn tiền hoặc thanh toán sản phẩm sẽ được lưu trữ minh bạch tại đây.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Mã GD / Loại</th>
                    <th className="py-3 px-4">Mô Tả & Tham Chiếu</th>
                    <th className="py-3 px-4 text-right">Biến Động</th>
                    <th className="py-3 px-4 text-right">Trước / Sau</th>
                    <th className="py-3 px-4 text-right">Thời Gian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {transactions.map((tx) => {
                    const isCredit = tx.direction === "CREDIT";
                    const typeCfg = TYPE_LABELS[tx.type] || { label: tx.type, color: "bg-slate-700 text-slate-300 border-slate-600" };
                    return (
                      <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-sans flex flex-col gap-1 items-start">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${typeCfg.color}`}>
                              {typeCfg.label}
                            </span>
                            <span className="text-[10px] text-slate-500 truncate max-w-[120px]" title={tx.id}>
                              #{tx.id.substring(0, 8)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-sans">
                          <p className="text-slate-200 font-medium">{tx.description || "--"}</p>
                          {tx.referenceType && (
                            <span className="text-[11px] text-slate-400">
                              Ref: {tx.referenceType} #{tx.referenceId ? tx.referenceId.substring(0, 8) : "--"}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold">
                          <span className={isCredit ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                            {isCredit ? "+" : "-"}{formatVND(tx.amount)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-400 text-[11px]">
                          <div>Trước: {formatVND(tx.balanceBefore)}</div>
                          <div className="text-slate-200">Sau: {formatVND(tx.balanceAfter)}</div>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-400 text-[11px] font-sans">
                          {formatDate(tx.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400">
                Trang {pagination.page} / {pagination.totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => fetchTransactions(pagination.page - 1)}
                  className="px-3 py-1 rounded-lg border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white disabled:opacity-40 transition-all cursor-pointer"
                >
                  Trang trước
                </button>
                <button
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchTransactions(pagination.page + 1)}
                  className="px-3 py-1 rounded-lg border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white disabled:opacity-40 transition-all cursor-pointer"
                >
                  Trang sau
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Notice Modal for Topup (Phase 2 Roadmap) */}
      {topupNoticeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setTopupNoticeOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-cyan-500/30 bg-[#0B132B] p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>💳 Cổng Nạp Tiền Tự Động</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Hệ thống hỗ trợ nạp tiền tự động qua <strong className="text-cyan-400">Gạch Thẻ Fast (Card Telco)</strong> và <strong className="text-emerald-400">VietQR PayOS</strong> sẽ được mở khóa hoàn chỉnh trong <strong>Phase 2 (Payment Integration)</strong>.
            </p>
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-xs text-slate-400 space-y-1">
              <div>✓ Bảo vệ chống callback trùng (Idempotent Webhooks)</div>
              <div>✓ Tự động cộng số dư ví qua Wallet Ledger</div>
              <div>✓ Tỷ giá chiết khấu thẻ cào cập nhật theo API đối tác</div>
            </div>
            <button
              onClick={() => setTopupNoticeOpen(false)}
              className="w-full rounded-xl bg-cyan-600 hover:bg-cyan-500 py-2 text-xs font-bold text-white transition-all cursor-pointer"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
