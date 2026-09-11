import React, { useState, useEffect, useRef } from "react";
import {
  Zap,
  Search,
  Lock,
  Server,
  Layers,
  Shield,
  RefreshCw,
  CreditCard,
  HelpCircle,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { api } from "../api/client.js";
import { PaymentModal } from "../components/PaymentModal.jsx";
import { QuickStartCard } from "../components/QuickStartCard.jsx";

const STANDARD_PLANS = [
  {
    id: "day",
    name: "1 Ngay",
    badge: "Trial",
    duration: "24 gio",
    priceFormatted: "10,000",
    priceNumber: 10000,
    plan: "basic",
    maxDevices: 1,
    enabled: true,
    highlight: false,
    description: "Danh cho nhu cau test nhanh hoac chay ngan han.",
    features: ["1 may active", "1 clone chay cung luc", "Auto join server it nguoi", "Anti-AFK co ban", "Auto rejoin khi crash/kick"]
  },
  {
    id: "week",
    name: "7 Ngay",
    badge: "Weekly",
    duration: "7 ngay",
    priceFormatted: "40,000",
    priceNumber: 40000,
    plan: "standard",
    maxDevices: 1,
    enabled: true,
    highlight: false,
    description: "Goi tiet kiem tuan cho treo farm va canh bao co ban.",
    features: ["1 may active", "Toi da 5 clone", "Auto join server it nguoi", "Canh bao Discord", "Ho tro profile cau hinh"]
  },
  {
    id: "month",
    name: "30 Ngay",
    badge: "Pho bien",
    duration: "30 ngay",
    priceFormatted: "100,000",
    priceNumber: 100000,
    plan: "pro",
    maxDevices: 2,
    enabled: true,
    highlight: true,
    description: "Goi tieu chuan cho nhieu tai khoan va thiet bi chay song song.",
    features: ["2 may active cung luc", "Toi da 20 clone", "Auto join server it nguoi", "Canh bao Discord va profile", "Ho tro installer Roblox"]
  },
  {
    id: "lifetime",
    name: "Tron Doi",
    badge: "Lifetime",
    duration: "Vinh vien",
    priceFormatted: "250,000",
    priceNumber: 250000,
    plan: "business",
    maxDevices: 4,
    enabled: true,
    highlight: false,
    description: "Mua mot lan, dung dai han va mo khoa tinh nang nang cao.",
    features: ["4 may active cung luc", "Toi da 100 clone", "Full tinh nang goi Pro", "Freeform da cua so", "Ho tro uu tien 1-1"]
  }
];

export function StorefrontPage({ onNavigateToPortal, onNavigateToAdmin }) {
  const [plans, setPlans] = useState(STANDARD_PLANS);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [purchasedInfo, setPurchasedInfo] = useState(null); // { key, planName }
  const [activeMobileIndex, setActiveMobileIndex] = useState(2); // Default to 30-day (index 2)
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchDeltaX, setTouchDeltaX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    let isMounted = true;
    api.getPublicPricing()
      .then((serverPlans) => {
        if (isMounted && Array.isArray(serverPlans) && serverPlans.length > 0) {
          setPlans(serverPlans);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Set default active index to highlighted plan once plans load
  useEffect(() => {
    const highlightIdx = plans.findIndex(p => p.highlight);
    if (highlightIdx !== -1) {
      setActiveMobileIndex(highlightIdx);
    }
  }, [plans]);

  const handleTouchStart = (e) => {
    setTouchStartX(e.touches ? e.touches[0].clientX : e.clientX);
    setIsDragging(true);
    setTouchDeltaX(0);
  };

  const handleTouchMove = (e) => {
    if (!isDragging || touchStartX === null) return;
    const currentX = e.touches ? e.touches[0].clientX : e.clientX;
    const delta = currentX - touchStartX;
    // Add resistance at boundaries
    if ((activeMobileIndex === 0 && delta > 0) || (activeMobileIndex === plans.length - 1 && delta < 0)) {
      setTouchDeltaX(delta * 0.3);
    } else {
      setTouchDeltaX(delta);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (touchDeltaX < -45 && activeMobileIndex < plans.length - 1) {
      setActiveMobileIndex((prev) => prev + 1);
    } else if (touchDeltaX > 45 && activeMobileIndex > 0) {
      setActiveMobileIndex((prev) => prev - 1);
    }
    setTouchDeltaX(0);
    setTouchStartX(null);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-emerald-500/25 selection:text-emerald-200 antialiased relative bg-transparent text-slate-200 overflow-x-hidden">
      {/* 1. COMPACT GLASSMORPHIC HEADER */}
      <header className="w-full border-b border-slate-800/80 bg-[#070D18]/90 sticky top-0 z-50 backdrop-blur-xl transition-all">
        <div className="max-w-[1280px] mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          {/* Left Branding */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="relative group shrink-0">
              <div className="absolute -inset-0.5 bg-emerald-500/40 rounded-lg blur-sm group-hover:bg-emerald-400/60 transition duration-300" />
              <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-b from-slate-900 to-[#0B1322] border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-inner">
                <Zap className="w-4 h-4 sm:w-5 sm:h-5 drop-shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="font-extrabold text-sm sm:text-lg tracking-tight text-white whitespace-nowrap drop-shadow-sm">
                Auto Rejoin Pro
              </span>
              <span className="hidden xs:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-semibold shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                v4.0
              </span>
            </div>
          </div>

          {/* Right Nav Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <button
              onClick={onNavigateToPortal}
              className="group h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg border border-slate-700/70 bg-slate-900/80 hover:bg-slate-800 hover:border-slate-600 text-slate-200 hover:text-white text-xs font-medium transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-400 transition-colors" />
              <span className="hidden sm:inline">Tra Cứu Key / Đổi Máy</span>
              <span className="sm:hidden text-[11px]">Tra cứu</span>
            </button>
            <button
              onClick={onNavigateToAdmin}
              className="group h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 hover:border-slate-700 text-slate-400 hover:text-white text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-400 transition-colors" />
              <span className="text-[11px] sm:text-xs">Admin</span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT CONTAINER */}
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-3.5 sm:px-6 py-4 sm:py-8 space-y-6 sm:space-y-8">
        {/* ALL-IN-ONE QUICK START CARD (AFTER PURCHASE) */}
        {purchasedInfo && (
          <div className="scroll-mt-20" id="quick-start-section">
            <QuickStartCard
              licenseKey={purchasedInfo.key}
              planName={purchasedInfo.planName}
              onNavigateToPortal={onNavigateToPortal}
              onBuyMore={() => setPurchasedInfo(null)}
            />
          </div>
        )}

        {/* 2. PRICING SECTION (MOBILE: TOUCH SWIPE IOS CAROUSEL / DESKTOP: 4-COL GRID) */}
        <section className="space-y-3.5 pt-1">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono font-semibold tracking-wider text-emerald-400 uppercase">
                <CreditCard className="w-3.5 h-3.5" />
                BẢNG GIÁ & CHỌN GÓI
              </div>
              <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white mt-0.5">
                Chọn gói sử dụng
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                License kích hoạt tự động qua VietQR sau khi thanh toán.
              </p>
            </div>
            <div className="flex items-center gap-2.5 text-xs font-mono text-slate-400 bg-slate-900/70 border border-slate-800/80 px-2.5 py-1 rounded-lg self-start sm:self-auto">
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-300 text-[11px] sm:text-xs">Thanh toán an toàn</span>
              </div>
              <span className="text-slate-700">•</span>
              <div className="flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-300 text-[11px] sm:text-xs">Hỗ trợ 24/7</span>
              </div>
            </div>
          </div>

          {/* MOBILE ONLY: iOS App Store Segmented Pill Control */}
          <div className="sm:hidden flex items-center justify-between p-1 bg-slate-900/90 border border-slate-800 rounded-xl shadow-inner backdrop-blur-md">
            {plans.map((p, idx) => {
              const isActive = activeMobileIndex === idx;
              return (
                <button
                  key={p.id}
                  onClick={() => setActiveMobileIndex(idx)}
                  className={`flex-1 py-1.5 px-1 rounded-lg text-[11px] font-medium tracking-tight transition-all duration-200 text-center relative ${
                    isActive
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/20 font-bold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {p.name}
                  {p.highlight && (
                    <span className="absolute -top-1 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  )}
                </button>
              );
            })}
          </div>

          {/* MOBILE ONLY: Interactive iOS Touch Swipe Carousel with 3D Depth & Peeking Side Cards */}
          <div className="sm:hidden relative overflow-hidden py-1 select-none">
            {/* Swipeable Track */}
            <div
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onMouseDown={handleTouchStart}
              onMouseMove={handleTouchMove}
              onMouseUp={handleTouchEnd}
              onMouseLeave={handleTouchEnd}
              className="flex items-center cursor-grab active:cursor-grabbing"
              style={{
                transform: `translateX(calc(${10 - (activeMobileIndex * 80)}vw + ${touchDeltaX}px))`,
                transition: isDragging ? "none" : "transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)"
              }}
            >
              {plans.map((plan, idx) => {
                const isActive = activeMobileIndex === idx;
                const isFeatured = Boolean(plan.highlight);

                return (
                  <div
                    key={plan.id}
                    onClick={() => setActiveMobileIndex(idx)}
                    style={{
                      transform: `scale(${isActive ? 1 : 0.92})`,
                      opacity: isActive ? 1 : 0.55,
                      transition: isDragging ? "none" : "all 0.35s cubic-bezier(0.25, 1, 0.5, 1)"
                    }}
                    className={`w-[80vw] max-w-[320px] shrink-0 rounded-2xl p-4 flex flex-col justify-between relative transition-all duration-300 ${
                      isActive
                        ? isFeatured
                          ? "border-2 border-emerald-400 bg-gradient-to-b from-[#11233B] to-[#0A1322] shadow-[0_0_35px_-5px_rgba(16,185,129,0.38)]"
                          : "border-2 border-slate-600 bg-[#0F1B2E] shadow-[0_0_25px_rgba(0,0,0,0.5)]"
                        : "border border-slate-800/80 bg-[#0B1322]/80"
                    }`}
                  >
                    {/* Top highlight bar for featured */}
                    {isFeatured && (
                      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 rounded-t-2xl" />
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-base font-bold text-white tracking-tight">{plan.name}</span>
                        {plan.badge && (
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                              isFeatured
                                ? "text-emerald-300 bg-emerald-950/80 border border-emerald-400/50 shadow-[0_0_10px_rgba(16,185,129,0.3)] flex items-center gap-1"
                                : "text-slate-400 bg-slate-900 border border-slate-800"
                            }`}
                          >
                            {isFeatured && <Zap className="w-3 h-3 text-emerald-400" />}
                            {plan.badge}
                          </span>
                        )}
                      </div>

                      <div className="mb-3 flex items-baseline">
                        <span className="font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
                          {plan.priceFormatted || plan.priceNumber?.toLocaleString("vi-VN")}
                        </span>
                        <span
                          className={`font-mono text-xs ml-1.5 font-semibold ${
                            isFeatured ? "text-emerald-400" : "text-slate-400"
                          }`}
                        >
                          VNĐ
                        </span>
                      </div>

                      <div
                        className={`pt-2.5 border-t space-y-1.5 ${
                          isFeatured ? "border-emerald-500/20" : "border-slate-800/80"
                        }`}
                      >
                        {plan.features?.map((f, fIdx) => (
                          <div
                            key={fIdx}
                            className={`flex items-start gap-1.5 text-xs ${
                              isFeatured && fIdx === 0
                                ? "text-white font-semibold"
                                : "text-slate-300"
                            }`}
                          >
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span className="text-[11px] leading-tight">{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPlan(plan);
                      }}
                      className={`mt-4 w-full h-10 rounded-xl text-xs font-semibold tracking-wide transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                        isFeatured
                          ? "bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-bold shadow-lg shadow-emerald-500/30"
                          : "border border-slate-700 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-200"
                      }`}
                    >
                      <span>Mua ngay</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Mobile Bottom Navigation: Left Arrow + Pill Dots + Right Arrow */}
            <div className="flex items-center justify-between px-6 pt-3">
              <button
                onClick={() => setActiveMobileIndex((prev) => Math.max(0, prev - 1))}
                disabled={activeMobileIndex === 0}
                aria-label="Previous Plan"
                className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
                  activeMobileIndex === 0
                    ? "opacity-30 border-slate-800 text-slate-600 cursor-not-allowed"
                    : "border-slate-700 bg-slate-900/90 text-slate-200 hover:text-white hover:bg-slate-800 active:scale-90"
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5">
                {plans.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveMobileIndex(idx)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      activeMobileIndex === idx
                        ? "w-6 bg-emerald-400 shadow-[0_0_8px_#10B981]"
                        : "w-2 bg-slate-700 hover:bg-slate-500"
                    }`}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>

              <button
                onClick={() => setActiveMobileIndex((prev) => Math.min(plans.length - 1, prev + 1))}
                disabled={activeMobileIndex === plans.length - 1}
                aria-label="Next Plan"
                className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
                  activeMobileIndex === plans.length - 1
                    ? "opacity-30 border-slate-800 text-slate-600 cursor-not-allowed"
                    : "border-slate-700 bg-slate-900/90 text-slate-200 hover:text-white hover:bg-slate-800 active:scale-90"
                }`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* DESKTOP ONLY: 4-COLUMN GRID */}
          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 pb-3 pt-1">
            {plans.map((plan) => {
              const isFeatured = Boolean(plan.highlight);
              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 relative group select-none ${
                    isFeatured
                      ? "border-2 border-emerald-500/80 bg-gradient-to-b from-[#0F1E33] to-[#0A1322] shadow-[0_0_30px_-5px_rgba(16,185,129,0.28)]"
                      : "border border-slate-800/90 bg-[#0B1322]/85 hover:bg-[#0D172A] hover:border-slate-700 hover:shadow-xl"
                  }`}
                >
                  {/* Top highlight bar for featured */}
                  {isFeatured && (
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 rounded-t-2xl" />
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-base font-bold text-white tracking-tight">{plan.name}</span>
                      {plan.badge && (
                        <span
                          className={`text-[10px] sm:text-[11px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                            isFeatured
                              ? "text-emerald-300 bg-emerald-950/80 border border-emerald-400/50 shadow-[0_0_10px_rgba(16,185,129,0.3)] flex items-center gap-1"
                              : "text-slate-400 bg-slate-900 border border-slate-800"
                          }`}
                        >
                          {isFeatured && <Zap className="w-3 h-3 text-emerald-400" />}
                          {plan.badge}
                        </span>
                      )}
                    </div>

                    <div className="mb-3.5 flex items-baseline">
                      <span className="font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
                        {plan.priceFormatted || plan.priceNumber?.toLocaleString("vi-VN")}
                      </span>
                      <span
                        className={`font-mono text-xs ml-1.5 font-semibold ${
                          isFeatured ? "text-emerald-400" : "text-slate-400"
                        }`}
                      >
                        VNĐ
                      </span>
                    </div>

                    <div
                      className={`pt-3 border-t space-y-2 ${
                        isFeatured ? "border-emerald-500/20" : "border-slate-800/80"
                      }`}
                    >
                      {plan.features?.map((f, idx) => (
                        <div
                          key={idx}
                          className={`flex items-start gap-2 text-xs ${
                            isFeatured && idx === 0
                              ? "text-white font-semibold"
                              : "text-slate-300"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span className="text-[11px] sm:text-xs leading-tight">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedPlan(plan)}
                    className={`mt-5 w-full h-10 rounded-xl text-xs font-semibold tracking-wide transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                      isFeatured
                        ? "bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-bold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/40"
                        : "border border-slate-700 bg-slate-800/80 hover:bg-slate-700 hover:text-white text-slate-200"
                    }`}
                  >
                    <span>Mua ngay</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* 3. COMPACT FEATURES SECTION: 2x2 on Mobile, 4 Columns on Desktop */}
        <section className="space-y-2.5 pt-1">
          <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-sm bg-emerald-500" />
            Tính năng cốt lõi
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 rounded-xl border border-slate-800/90 bg-[#0B1322]/80 backdrop-blur-md divide-x divide-y sm:divide-y-0 divide-slate-800/80 overflow-hidden shadow-xl">
            {/* Col 1 */}
            <div className="p-3.5 sm:p-4 space-y-1.5 transition-all duration-300 hover:bg-slate-800/30 group">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg border border-emerald-500/25 bg-emerald-950/30 flex items-center justify-center text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.08)] group-hover:scale-105 transition-all">
                <Server className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-emerald-300 transition-colors leading-tight">
                Auto Low-Server
              </h3>
              <p className="text-[11px] text-slate-400 leading-tight font-sans">
                Tìm server ít người, hạn chế farm ảo.
              </p>
            </div>
            {/* Col 2 */}
            <div className="p-3.5 sm:p-4 space-y-1.5 transition-all duration-300 hover:bg-slate-800/30 group">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg border border-emerald-500/25 bg-emerald-950/30 flex items-center justify-center text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.08)] group-hover:scale-105 transition-all">
                <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-emerald-300 transition-colors leading-tight">
                Multi-Clone Termux
              </h3>
              <p className="text-[11px] text-slate-400 leading-tight font-sans">
                Chạy nhiều acc cùng lúc mượt mà.
              </p>
            </div>
            {/* Col 3 */}
            <div className="p-3.5 sm:p-4 space-y-1.5 transition-all duration-300 hover:bg-slate-800/30 group">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg border border-emerald-500/25 bg-emerald-950/30 flex items-center justify-center text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.08)] group-hover:scale-105 transition-all">
                <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-emerald-300 transition-colors leading-tight">
                Anti-AFK & Watchdog
              </h3>
              <p className="text-[11px] text-slate-400 leading-tight font-sans">
                Chống kick và tự rejoin khi crash.
              </p>
            </div>
            {/* Col 4 */}
            <div className="p-3.5 sm:p-4 space-y-1.5 transition-all duration-300 hover:bg-slate-800/30 group">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg border border-emerald-500/25 bg-emerald-950/30 flex items-center justify-center text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.08)] group-hover:scale-105 transition-all">
                <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-emerald-300 transition-colors leading-tight">
                Đổi Máy 1-Chạm
              </h3>
              <p className="text-[11px] text-slate-400 leading-tight font-sans">
                Gỡ máy cũ chuyển sang máy mới tức thì.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* 5. MINIMAL REFINED FOOTER */}
      <footer className="w-full border-t border-slate-800/70 bg-[#070D18]/90 py-5 mt-8 backdrop-blur-md">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
          {/* Left Notice */}
          <div className="text-slate-500 max-w-xl text-center md:text-left leading-relaxed text-[11px]">
            Lưu ý: Sản phẩm chỉ hỗ trợ cho mục đích cá nhân, vui lòng tuân thủ Điều khoản sử dụng Roblox.
          </div>
          {/* Right Links */}
          <div className="flex flex-wrap items-center justify-center gap-5 text-slate-400 font-medium text-xs">
            <button onClick={onNavigateToPortal} className="hover:text-emerald-400 transition-colors">
              Tra cứu key
            </button>
            <span className="text-slate-800">•</span>
            <span className="text-slate-500">Termux & PC Support</span>
            <span className="text-slate-800">•</span>
            <a href="https://discord.gg" target="_blank" rel="noreferrer" className="hover:text-emerald-400 transition-colors">
              Liên hệ hỗ trợ
            </a>
          </div>
        </div>
      </footer>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={Boolean(selectedPlan)}
        selectedPlan={selectedPlan}
        onClose={() => setSelectedPlan(null)}
        onKeyPurchased={(key) => {
          const currentPlan = selectedPlan;
          setPurchasedInfo({ key, planName: currentPlan?.name || "Pro" });
          // Scroll smoothly to quick start section
          setTimeout(() => {
            const el = document.getElementById("quick-start-section");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }, 100);
        }}
      />
    </div>
  );
}
