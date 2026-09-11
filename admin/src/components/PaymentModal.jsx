import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Copy,
  Check,
  AlertCircle,
  Clock,
  ShieldCheck,
  RefreshCw,
  QrCode,
  Building2,
  User,
  Zap,
  HelpCircle,
  CheckCircle2
} from "lucide-react";
import { api } from "../api/client.js";

export function PaymentModal({ isOpen, onClose, selectedPlan, onKeyPurchased }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("pending"); // "pending" | "paid" | "expired" | "failed"
  const [fulfilledKey, setFulfilledKey] = useState(null);
  const [placeId, setPlaceId] = useState("107778070777162");
  const [timeLeft, setTimeLeft] = useState(1200); // 20 mins in seconds

  const [copiedStk, setCopiedStk] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [copiedNote, setCopiedNote] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);

  const pollingRef = useRef(null);
  const timerRef = useRef(null);

  // 1. Create order on open
  const createOrder = async () => {
    if (!selectedPlan) return;
    try {
      setLoading(true);
      setError(null);
      setPaymentStatus("pending");
      setFulfilledKey(null);

      const orderData = await api.createPaymentOrder(selectedPlan.id);
      setOrder(orderData);

      // Calculate remaining seconds
      if (orderData.expiredAt) {
        const diffSec = Math.max(0, Math.floor((new Date(orderData.expiredAt).getTime() - Date.now()) / 1000));
        setTimeLeft(diffSec || 1200);
      }
    } catch (err) {
      setError(err.message || "Không thể tạo đơn thanh toán.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && selectedPlan) {
      createOrder();
    } else {
      setOrder(null);
      setPaymentStatus("pending");
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, selectedPlan]);

  // 2. Countdown timer
  useEffect(() => {
    if (!order || paymentStatus !== "pending") return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setPaymentStatus("expired");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [order, paymentStatus]);

  // 3. Status Polling (Every 3 seconds)
  useEffect(() => {
    if (!order || paymentStatus !== "pending") return;

    const checkStatus = async () => {
      try {
        const res = await api.getPaymentStatus(order.paymentCode);
        if (res.status === "paid" && res.licenseReady && res.license?.key) {
          setPaymentStatus("paid");
          setFulfilledKey(res.license.key);
          if (pollingRef.current) clearInterval(pollingRef.current);
          if (timerRef.current) clearInterval(timerRef.current);

          // Notify parent Storefront
          if (onKeyPurchased) {
            onKeyPurchased(res.license.key);
          }
        } else if (res.status === "expired" || res.status === "failed") {
          setPaymentStatus(res.status);
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      } catch (_e) {
        // Continue polling silently on transient network errors
      }
    };

    pollingRef.current = setInterval(checkStatus, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [order, paymentStatus, onKeyPurchased]);

  // Handle discard/cancellation when user closes or aborts
  const handleCancelAndClose = async () => {
    if (order?.paymentCode && paymentStatus === "pending") {
      try {
        api.cancelPaymentOrder(order.paymentCode, "user_cancelled").catch(() => {});
      } catch (_e) {}
    }
    onClose();
  };

  const copyToClipboard = (text, setter) => {
    if (!text) return;
    navigator.clipboard.writeText(String(text));
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const allInOneCommand = fulfilledKey
    ? `cd ~; rm -rf auto-rejoin; mkdir -p auto-rejoin; cd auto-rejoin; curl -fSL https://raw.githubusercontent.com/Gnas260605/auto-rejoin/main/setup.sh -o setup.sh; AUTO_REJOIN_LICENSE_API="${window.location.origin}" AUTO_REJOIN_LICENSE_MODE=required LICENSE_KEY="${fulfilledKey}" JOIN_LOW_SERVER=true LOW_SERVER_MIN_PLAYERS=0 LOW_SERVER_MAX_PLAYERS=2 LOW_SERVER_STRICT=true bash setup.sh ${placeId || "107778070777162"}`
    : "";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-[#0e1017] border border-slate-800 rounded-2xl shadow-2xl p-5 text-slate-200 flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-pixel font-bold text-sm text-white">Thanh toán VietQR</h3>
              <span className="text-[10px] font-pixel px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                Tự động
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Gói {selectedPlan?.name} &bull; {order?.expectedAmountFormatted || selectedPlan?.priceFormatted}
            </p>
          </div>
          <button
            onClick={handleCancelAndClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Đóng & Hủy đơn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold">Đang khởi tạo đơn hàng từ máy chủ...</span>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="py-8 space-y-4 text-center">
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2 justify-center">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={createOrder}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Thử tạo lại đơn</span>
            </button>
          </div>
        )}

        {/* STATE: PAID (SUCCESS) */}
        {!loading && paymentStatus === "paid" && (
          <div className="py-8 space-y-5 text-center animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-white">Thanh Toán Thành Công!</h4>
              <p className="text-xs text-slate-400">
                Hệ thống đã xác thực giao dịch và cấp License Key cho bạn.
              </p>
            </div>

            {fulfilledKey && (
              <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2 text-left">
                <span className="text-[11px] font-mono text-slate-500 uppercase block">
                  License Key Của Bạn
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-emerald-400 select-all tracking-wider">
                    {fulfilledKey}
                  </span>
                  <button
                    onClick={() => copyToClipboard(fulfilledKey, setCopiedNote)}
                    className="p-1.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-xs flex items-center gap-1"
                  >
                    {copiedNote ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedNote ? "Đã copy" : "Copy"}</span>
                  </button>
                </div>
              </div>
            )}

            {fulfilledKey && (
              <div className="p-3.5 bg-slate-950/80 border border-emerald-500/30 rounded-xl space-y-2 text-left">
                <label className="text-[11px] font-mono text-slate-400 uppercase block">
                  Place ID game can vao
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{3,20}"
                  value={placeId}
                  onChange={(e) => setPlaceId(e.target.value.replace(/\D/g, ""))}
                  className="w-full px-3 py-2 rounded-lg bg-black/70 border border-slate-800 text-emerald-300 font-mono text-xs outline-none focus:border-emerald-500"
                />
                <div className="flex items-start justify-between gap-2 p-2.5 rounded-lg bg-black/70 border border-slate-800">
                  <code className="text-[11px] text-emerald-300 font-mono break-all select-all text-left">
                    {allInOneCommand}
                  </code>
                  <button
                    onClick={() => copyToClipboard(allInOneCommand, setCopiedCommand)}
                    className="p-1.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-xs flex items-center gap-1 shrink-0"
                  >
                    {copiedCommand ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCommand ? "Da copy" : "Copy lenh"}</span>
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-emerald-500/20"
            >
              Xem hướng dẫn cài đặt All-in-One &rarr;
            </button>
          </div>
        )}

        {/* STATE: EXPIRED */}
        {!loading && paymentStatus === "expired" && (
          <div className="py-8 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
              <Clock className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">Đơn Thanh Toán Đã Hết Hạn</h4>
              <p className="text-xs text-slate-400">
                Mỗi mã QR chỉ có hiệu lực trong 20 phút. Vui lòng tạo đơn mới để thanh toán.
              </p>
            </div>
            <button
              onClick={createOrder}
              className="w-full h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tạo mã QR thanh toán mới</span>
            </button>
          </div>
        )}

        {/* STATE: PENDING (QR DISPLAY & POLLING) */}
        {!loading && paymentStatus === "pending" && order && (
          <div className="py-3 space-y-4 text-xs">
            {/* Countdown bar */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] font-mono">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Thời gian thanh toán còn lại:
              </span>
              <span className="font-bold text-amber-400 text-xs">{formatTimer(timeLeft)}</span>
            </div>

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center p-3.5 bg-white rounded-xl shadow-inner border border-slate-300">
              <img
                src={order.qrUrl}
                alt="VietQR Auto Rejoin Pro"
                className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
                loading="eager"
              />
              <span className="text-[10px] text-slate-600 font-mono mt-1 font-semibold">
                Quét mã bằng app ngân hàng / MoMo / ViettelPay
              </span>
            </div>

            {/* Transfer Details Card */}
            <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5">
              {/* Bank & Account */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-slate-400 text-[11px] flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  Ngân hàng:
                </span>
                <span className="font-bold text-white text-xs font-mono">{order.bankName}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-slate-400 text-[11px]">Số tài khoản:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-100">{order.accountNumber}</span>
                  <button
                    onClick={() => copyToClipboard(order.accountNumber, setCopiedStk)}
                    className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                    title="Sao chép số tài khoản"
                  >
                    {copiedStk ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-slate-400 text-[11px] flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  Chủ tài khoản:
                </span>
                <span className="font-semibold text-slate-200 text-xs">{order.accountName}</span>
              </div>

              {/* Exact Amount */}
              <div className="flex items-center justify-between pb-2 bg-emerald-950/20 p-2 rounded-lg border border-emerald-500/20">
                <span className="text-emerald-400 font-semibold text-[11px]">Số tiền chính xác:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-extrabold text-emerald-400 text-sm">
                    {order.expectedAmountFormatted}
                  </span>
                  <button
                    onClick={() => copyToClipboard(order.expectedAmount, setCopiedAmount)}
                    className="p-1 text-emerald-400 hover:text-emerald-300 rounded hover:bg-emerald-500/20 transition-colors"
                    title="Sao chép số tiền"
                  >
                    {copiedAmount ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Exact Transfer Content Memo */}
              <div className="space-y-1 bg-slate-900/90 p-2.5 rounded-lg border border-emerald-500/30">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-300">Nội dung chuyển khoản (bắt buộc):</span>
                  <button
                    onClick={() => copyToClipboard(order.transferContent, setCopiedNote)}
                    className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold"
                  >
                    {copiedNote ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedNote ? "Đã copy" : "Sao chép"}</span>
                  </button>
                </div>
                <div className="p-2 bg-black/80 rounded border border-slate-800 text-center font-mono font-bold text-sm text-emerald-300 tracking-widest select-all">
                  {order.transferContent}
                </div>
              </div>
            </div>

            {/* Live Verification Status Bar & Cancel Action */}
            <div className="p-3.5 bg-[#070D18] border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin shrink-0" />
                  <span className="font-semibold text-emerald-400">Đang chờ quét mã thanh toán...</span>
                </div>
                <button
                  onClick={handleCancelAndClose}
                  className="px-2.5 py-1 text-[11px] font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-md border border-rose-500/20 transition-colors"
                >
                  Hủy đơn này
                </button>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Vui lòng chuyển khoản đúng số tiền và nội dung. Hệ thống sẽ tự động xác thực và cấp License Key ngay khi nhận được tiền.
              </p>
              <p className="text-[10px] text-slate-500">
                💡 <span className="text-slate-400 font-medium">Bảo mật key:</span> Nếu bạn đóng cửa sổ hoặc không hoàn tất thanh toán, đơn hàng sẽ tự động hủy bỏ và không chiếm dụng key.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
