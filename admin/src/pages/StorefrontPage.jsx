import React, { useState, useEffect, useRef, useMemo } from "react";
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
  ChevronRight,
  ShieldCheck,
  Key,
  Download,
  Copy,
  Terminal,
  Sparkles,
  ExternalLink,
  Package,
  Clock,
  Smartphone,
  Send,
  AlertCircle,
  Activity,
  Award,
  Bell,
  CheckCircle2,
  DollarSign,
  ScanBarcode,
  RotateCw,
  MessageCircle,
  ChevronLeft,
  X,
  Loader2,
  Gift,
  CheckCheck,
  User
} from "lucide-react";
import { useCustomerAuth } from "../context/CustomerAuthContext.jsx";
import { CustomerAuthModal } from "../components/CustomerAuthModal.jsx";

// Telco definitions aligned with ShopRoblox
const TELCO_OPTIONS = [
  { value: "VIETTEL", label: "Viettel" },
  { value: "VINAPHONE", label: "Vinaphone" },
  { value: "MOBIFONE", label: "Mobifone" },
  { value: "VIETNAMOBILE", label: "Vietnamobile" },
  { value: "GARENA", label: "Garena" },
  { value: "ZING", label: "Zing (VNG)" },
  { value: "GATE", label: "Gate" },
  { value: "VCOIN", label: "Vcoin" }
];

const CARD_AMOUNTS = {
  VIETTEL: [10000, 20000, 30000, 50000, 100000, 200000, 300000, 500000, 1000000],
  VINAPHONE: [10000, 20000, 30000, 50000, 100000, 200000, 300000, 500000],
  MOBIFONE: [10000, 20000, 30000, 50000, 100000, 200000, 300000, 500000],
  VIETNAMOBILE: [10000, 20000, 50000, 100000, 200000, 300000, 500000],
  GARENA: [20000, 50000, 100000, 200000, 500000],
  ZING: [10000, 20000, 50000, 100000, 200000, 500000, 1000000],
  GATE: [10000, 20000, 50000, 100000, 200000, 500000],
  VCOIN: [10000, 20000, 30000, 50000, 100000, 200000, 300000, 500000, 1000000]
};

// Hero Banners
const DEFAULT_BANNERS = [
  {
    id: 1,
    title: "⚡ AUTO REJOIN ROBLOX PRO - HỆ THỐNG V2",
    subtitle: "Tự động kết nối lại khi Disconnect, Crash, Treo Acc 24/7 ổn định 100%",
    badge: "PHIÊN BẢN MỚI NHẤT",
    image: "/banners/gamepassblox.png",
    accent: "from-blue-600/80 to-cyan-500/80"
  },
  {
    id: 2,
    title: "🛡️ BẢO HÀNH ĐỔI MÁY & RESET HWID TỰ ĐỘNG",
    subtitle: "Mua gói reset HWID thao tác nhanh trong 3 giây không cần chờ admin",
    badge: "TỰ ĐỘNG 100%",
    image: "/banners/robux120H.png",
    accent: "from-emerald-600/80 to-teal-500/80"
  },
  {
    id: 3,
    title: "🎁 NẠP THẺ CÀO & TẶNG THƯỞNG CHIẾT KHẤU",
    subtitle: "Hỗ trợ Viettel, Vina, Mobi, Zing, Garena với tỷ giá ưu đãi nhất",
    badge: "NẠP TỰ ĐỘNG",
    image: "/banners/i7ni7zrayw.png",
    accent: "from-purple-600/80 to-pink-500/80"
  }
];

export function StorefrontPage({ onNavigateToPortal, onNavigateToAdmin, onNavigateToDashboard }) {
  const { customer, wallet } = useCustomerAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState("login");

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedVariants, setSelectedVariants] = useState({});
  const [recentActivities, setRecentActivities] = useState([]);

  // Carousel State
  const [currentSlide, setCurrentSlide] = useState(0);

  // Card Top-up State (ShopRoblox 1-to-1)
  const [cardTelco, setCardTelco] = useState("VIETTEL");
  const [cardAmount, setCardAmount] = useState("50000");
  const [cardSerial, setCardSerial] = useState("");
  const [cardPin, setCardPin] = useState("");
  const [cardContact, setCardContact] = useState("");
  const [cardErrors, setCardErrors] = useState({});
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [cardStatus, setCardStatus] = useState("idle"); // 'submitting' | 'processing' | 'success' | 'error'
  const [cardResult, setCardResult] = useState(null);

  // Checkout modal state
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [targetHwidKey, setTargetHwidKey] = useState("");
  const [activeOrder, setActiveOrder] = useState(null);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [fulfilledOrder, setFulfilledOrder] = useState(null);
  const [copiedContent, setCopiedContent] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Banner rotation
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % DEFAULT_BANNERS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const fetchCatalog = () => {
    fetch("/api/v1/store/products")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.products)) {
          setProducts(data.products);
          const initialVariants = {};
          data.products.forEach((p) => {
            if (p.variants && p.variants.length > 0) {
              initialVariants[p.id] = p.variants[0];
            }
          });
          setSelectedVariants(initialVariants);
        }
      })
      .catch((err) => console.error("Failed to load catalog:", err))
      .finally(() => setLoading(false));
  };

  const fetchRecentActivity = () => {
    fetch("/api/v1/store/recent-activity")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.activities)) {
          setRecentActivities(data.activities);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchCatalog();
    fetchRecentActivity();
    const actInterval = setInterval(fetchRecentActivity, 12000);
    return () => clearInterval(actInterval);
  }, []);

  // Strict Server-Side Polling for payment status (No client cheat button)
  useEffect(() => {
    if (!activeOrder || !checkoutModalOpen || fulfilledOrder) return;

    const intervalId = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/store/orders/${activeOrder.orderCode}`);
        const data = await res.json();
        if (data.ok && data.order) {
          if (data.order.status === "fulfilled" || data.order.status === "paid") {
            setFulfilledOrder(data.order);
            fetchRecentActivity();
            clearInterval(intervalId);
          }
        }
      } catch (err) {
        console.error("Order polling error:", err);
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [activeOrder, checkoutModalOpen, fulfilledOrder]);

  const handleOpenCheckout = (product) => {
    setSelectedProduct(product);
    setActiveOrder(null);
    setFulfilledOrder(null);
    setCheckoutModalOpen(true);
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;
    const variant = selectedVariants[selectedProduct.id] || (selectedProduct.variants && selectedProduct.variants[0]);
    if (!variant) return;

    if (selectedProduct.slug === "reset-hwid" && !targetHwidKey.trim()) {
      alert("Vui lòng nhập License Key cần Reset HWID!");
      return;
    }

    setOrderSubmitting(true);
    try {
      const payload = {
        productId: selectedProduct.id,
        variantId: variant.id,
        customerEmail: customerEmail.trim() || undefined,
        customerName: customerName.trim() || undefined,
        targetKey: selectedProduct.slug === "reset-hwid" ? targetHwidKey.trim() : undefined
      };

      const res = await fetch("/api/v1/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        alert(data.message || "Tạo đơn hàng thất bại. Vui lòng thử lại!");
        return;
      }

      setActiveOrder(data.order);
    } catch (err) {
      console.error("Checkout submit error:", err);
      alert("Lỗi kết nối máy chủ khi tạo đơn hàng.");
    } finally {
      setOrderSubmitting(false);
    }
  };

  const handleCardSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!cardPin.trim()) errors.pin = "Vui lòng nhập mã PIN";
    if (!cardSerial.trim()) errors.serial = "Vui lòng nhập số Serial";
    if (cardPin.trim().length < 8) errors.pin = "Mã PIN không hợp lệ (ít nhất 8 số)";
    if (cardSerial.trim().length < 8) errors.serial = "Số Serial không hợp lệ (ít nhất 8 số)";

    setCardErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setCardStatus("submitting");
    setCardModalOpen(true);
    setCardResult({
      telco: cardTelco,
      amount: cardAmount,
      serial: cardSerial.trim(),
      pin: cardPin.trim()
    });

    try {
      const res = await fetch("/api/v1/store/topup/card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telco: cardTelco,
          declaredAmount: Number(cardAmount),
          serial: cardSerial.trim(),
          pin: cardPin.trim(),
          contact: cardContact.trim() || undefined
        })
      });
      const data = await res.json();

      if (res.ok && data.ok) {
        setCardStatus("success");
        setCardResult((prev) => ({
          ...prev,
          message: data.message || "Gửi thẻ cào thành công! Hệ thống đang xử lý.",
          transactionCode: data.transaction?.transactionCode
        }));
        setCardPin("");
        setCardSerial("");
        fetchRecentActivity();
      } else {
        setCardStatus("error");
        setCardResult((prev) => ({
          ...prev,
          message: data.message || "Thẻ không hợp lệ hoặc đã qua sử dụng!"
        }));
      }
    } catch (err) {
      setCardStatus("error");
      setCardResult((prev) => ({
        ...prev,
        message: "Lỗi kết nối mạng đến cổng thẻ cào. Vui lòng thử lại sau!"
      }));
    }
  };

  const filteredProducts = useMemo(() => {
    if (selectedCategory === "all") return products;
    return products.filter((p) => p.category === selectedCategory);
  }, [products, selectedCategory]);

  const categories = [
    { id: "all", label: "Tất Cả Sản Phẩm", icon: Package },
    { id: "tools", label: "Tool Auto Rejoin", icon: Zap },
    { id: "service", label: "Dịch Vụ HWID & Key", icon: ShieldCheck },
    { id: "scripts", label: "Scripts & Gamepass", icon: Sparkles }
  ];

  return (
    <div className="min-h-screen bg-[#0d1117] text-gray-100 font-sans selection:bg-blue-500 selection:text-white pb-16">
      {/* Top Gaming Navigation Header */}
      <header className="sticky top-0 z-40 bg-[#161b22]/90 backdrop-blur-md border-b border-gray-800 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 p-0.5 shadow-lg shadow-blue-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-[#161b22] rounded-[10px] flex items-center justify-center">
                <Zap className="w-5 h-5 text-cyan-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg tracking-tight bg-gradient-to-r from-white via-gray-200 to-cyan-300 bg-clip-text text-transparent">
                  AUTO REJOIN PRO
                </span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  ONLINE 24/7
                </span>
              </div>
              <p className="text-[11px] text-gray-400 font-medium">Hệ Thống Phân Phối Key & Nạp Thẻ Tự Động</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {onNavigateToPortal && (
              <button
                onClick={onNavigateToPortal}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-300 hover:text-white bg-gray-800/80 hover:bg-gray-700 border border-gray-700/60 rounded-xl transition-all cursor-pointer"
              >
                <Key className="w-3.5 h-3.5 text-blue-400" />
                Tra Cứu Key
              </button>
            )}

            {customer ? (
              <button
                onClick={onNavigateToDashboard}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-xl border border-cyan-500/40 bg-[#0c192c] hover:bg-[#12233f] text-cyan-300 transition-all cursor-pointer shadow-md shadow-cyan-950/40"
                title="Mở Bảng Điều Khiển Khách Hàng & Quản Lý Ví"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>@{customer.username}</span>
                <span className="text-gray-600">|</span>
                <span className="text-emerald-400 font-extrabold">
                  {new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(wallet?.balance || 0)}
                </span>
              </button>
            ) : (
              <button
                onClick={() => { setAuthModalTab("login"); setAuthModalOpen(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800/60 rounded-xl transition-all cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                <span>Đăng Nhập</span>
              </button>
            )}

            {onNavigateToAdmin && (
              <button
                onClick={onNavigateToAdmin}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-600/25 transition-all active:scale-95 cursor-pointer"
              >
                <Server className="w-3.5 h-3.5" />
                Admin Hub
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* =========================================================================
            HERO SECTION (ShopRoblox Grid): 8 Cols Hero Carousel + 4 Cols Card Topup
            ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left 8 Cols: Gaming Carousel Banner */}
          <div className="lg:col-span-8 flex flex-col justify-between relative rounded-2xl overflow-hidden border border-gray-800 bg-[#161b22] shadow-2xl min-h-[360px]">
            {DEFAULT_BANNERS.map((banner, index) => (
              <div
                key={banner.id}
                className={`absolute inset-0 transition-opacity duration-700 flex flex-col justify-end p-6 sm:p-8 ${
                  index === currentSlide ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
                }`}
              >
                {/* Background Image with Overlay */}
                <div className="absolute inset-0 bg-[#0d1117]/60 z-10" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#161b22] via-[#161b22]/70 to-transparent z-20" />
                <img
                  src={banner.image}
                  alt={banner.title}
                  className="absolute inset-0 w-full h-full object-cover object-center filter brightness-90"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />

                {/* Banner Content */}
                <div className="relative z-30 space-y-3 max-w-xl">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500 text-white shadow-lg shadow-blue-500/30">
                    <Sparkles className="w-3 h-3" />
                    {banner.badge}
                  </span>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight uppercase leading-tight drop-shadow-md">
                    {banner.title}
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-300 font-medium leading-relaxed drop-shadow">
                    {banner.subtitle}
                  </p>

                  <div className="pt-2 flex flex-wrap gap-3 items-center">
                    <a
                      href="#products-section"
                      className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition-all active:scale-95"
                    >
                      <Zap className="w-4 h-4 fill-white" />
                      Xem Bảng Giá Ngay
                    </a>
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-300 bg-black/40 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Giao dịch tự động 100%
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Carousel Controls */}
            <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
              {DEFAULT_BANNERS.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    idx === currentSlide ? "w-6 bg-cyan-400" : "w-2 bg-gray-600 hover:bg-gray-400"
                  }`}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Right 4 Cols: Widget Nạp Thẻ Cào (ShopRoblox 1-to-1) */}
          <div className="lg:col-span-4 bg-[#161b22] p-5 sm:p-6 rounded-2xl border border-gray-800 shadow-2xl flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500 opacity-70 group-hover:opacity-100 transition-opacity" />

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-black italic uppercase tracking-tight flex items-center gap-2 text-white">
                  <CreditCard className="w-5 h-5 text-cyan-400" />
                  Nạp Thẻ Tự Động
                </h3>
                <span className="text-[10px] font-black uppercase text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded-md">
                  Chiết Khấu 0%
                </span>
              </div>

              <form onSubmit={handleCardSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {/* Nhà Mạng */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">
                      Nhà Mạng
                    </label>
                    <div className="relative">
                      <select
                        value={cardTelco}
                        onChange={(e) => {
                          setCardTelco(e.target.value);
                          setCardAmount(CARD_AMOUNTS[e.target.value]?.[0] || "50000");
                        }}
                        className="w-full bg-[#0d1117] border border-gray-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none cursor-pointer appearance-none transition-all shadow-inner"
                      >
                        {TELCO_OPTIONS.map((t) => (
                          <option key={t.value} value={t.value} className="bg-[#161b22] text-white">
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <ChevronRight className="pointer-events-none absolute inset-y-0 right-2.5 my-auto w-3.5 h-3.5 rotate-90 text-gray-400" />
                    </div>
                  </div>

                  {/* Mệnh Giá */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">
                      Mệnh Giá
                    </label>
                    <div className="relative">
                      <select
                        value={cardAmount}
                        onChange={(e) => setCardAmount(e.target.value)}
                        className="w-full bg-[#0d1117] border border-gray-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none cursor-pointer appearance-none transition-all shadow-inner"
                      >
                        {(CARD_AMOUNTS[cardTelco] || []).map((amt) => (
                          <option key={amt} value={amt} className="bg-[#161b22] text-white">
                            {amt.toLocaleString("vi-VN")}đ
                          </option>
                        ))}
                      </select>
                      <ChevronRight className="pointer-events-none absolute inset-y-0 right-2.5 my-auto w-3.5 h-3.5 rotate-90 text-gray-400" />
                    </div>
                  </div>
                </div>

                {/* Mã Thẻ (Pin) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex justify-between">
                    <span>Mã Thẻ (Pin)</span>
                    {cardErrors.pin && <span className="text-rose-400 normal-case">{cardErrors.pin}</span>}
                  </label>
                  <div className="relative">
                    <ScanBarcode className="absolute inset-y-0 left-3 my-auto w-4 h-4 text-cyan-400 pointer-events-none" />
                    <input
                      type="text"
                      inputMode="numeric"
                      value={cardPin}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/[^0-9]/g, "");
                        setCardPin(digits);
                        if (cardErrors.pin) setCardErrors((p) => ({ ...p, pin: null }));
                      }}
                      placeholder="Nhập mã thẻ cào..."
                      maxLength={16}
                      className="w-full bg-[#0d1117] border border-gray-700 focus:border-cyan-400 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-white placeholder-gray-500 outline-none transition-all tracking-wider shadow-inner"
                    />
                  </div>
                </div>

                {/* Số Serial */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex justify-between">
                    <span>Số Seri</span>
                    {cardErrors.serial && <span className="text-rose-400 normal-case">{cardErrors.serial}</span>}
                  </label>
                  <div className="relative">
                    <Key className="absolute inset-y-0 left-3 my-auto w-4 h-4 text-cyan-400 pointer-events-none" />
                    <input
                      type="text"
                      inputMode="numeric"
                      value={cardSerial}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/[^0-9]/g, "");
                        setCardSerial(digits);
                        if (cardErrors.serial) setCardErrors((p) => ({ ...p, serial: null }));
                      }}
                      placeholder="Nhập số seri in trên thẻ..."
                      maxLength={18}
                      className="w-full bg-[#0d1117] border border-gray-700 focus:border-cyan-400 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-white placeholder-gray-500 outline-none transition-all tracking-wider shadow-inner"
                    />
                  </div>
                </div>

                {/* Liên hệ (Zalo / Discord) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">
                    Zalo / Discord liên hệ
                  </label>
                  <input
                    type="text"
                    value={cardContact}
                    onChange={(e) => setCardContact(e.target.value)}
                    placeholder="Để nhận hỗ trợ khi thẻ bị lỗi..."
                    className="w-full bg-[#0d1117] border border-gray-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs font-medium text-white placeholder-gray-500 outline-none transition-all shadow-inner"
                  />
                </div>

                <button
                  type="submit"
                  disabled={cardStatus === "submitting"}
                  className="w-full mt-2 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  {cardStatus === "submitting" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang Gửi Thẻ...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Nạp Thẻ Ngay
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between text-[11px] text-gray-400 font-medium">
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Xử lý 3-10 giây
              </span>
              <span className="text-gray-500">Hỗ trợ 24/7</span>
            </div>
          </div>
        </div>

        {/* =========================================================================
            MARQUEE ANNOUNCEMENT BAR (ShopRoblox 1-to-1)
            ========================================================================= */}
        <div className="overflow-hidden bg-[#161b22] border border-gray-800 rounded-xl h-11 flex items-center shadow-lg group">
          <div className="flex-shrink-0 bg-blue-600 h-full px-4 flex items-center justify-center text-white z-10 relative">
            <Bell className="w-4 h-4 animate-bounce" />
          </div>
          <div className="flex-1 whitespace-nowrap overflow-hidden">
            <div className="inline-block animate-marquee pl-[100%] hover:[animation-play-state:paused]">
              <span className="text-xs font-black text-cyan-300 uppercase tracking-widest pr-20">
                🔥 HỆ THỐNG GIAO KEY AUTO REJOIN V2 TỰ ĐỘNG 100% • HỖ TRỢ ĐỔI MÁY / RESET HWID NGAY LẬP TỨC • BẢO HÀNH TRỌN ĐỜI THEO THỜI HẠN GÓI
              </span>
            </div>
          </div>
        </div>

        {/* =========================================================================
            LIVE RECENT TRANSACTIONS TICKER (ShopRoblox 1-to-1)
            ========================================================================= */}
        {recentActivities.length > 0 && (
          <div className="overflow-hidden bg-[#161b22]/70 backdrop-blur-md border border-gray-800 rounded-xl h-10 flex items-center shadow-md">
            <div className="flex-shrink-0 bg-emerald-600 text-white font-black text-[10px] uppercase tracking-wider h-full px-3.5 flex items-center justify-center border-r border-gray-800 select-none z-10">
              ⚡ GIAO DỊCH MỚI
            </div>
            <div className="flex-1 whitespace-nowrap overflow-hidden relative h-full flex items-center">
              <div className="inline-flex items-center gap-8 animate-marquee-fast hover:[animation-play-state:paused] whitespace-nowrap pl-[100%]">
                {recentActivities.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-center gap-2 text-[11px] font-bold text-gray-300 uppercase tracking-wide shrink-0"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                    <span>
                      <span className="text-cyan-300 font-black">{act.customer_name || "Khách Hàng"}</span> vừa mua{" "}
                      <span className="text-white font-black">{act.title || act.product_name}</span>{" "}
                      <span className="text-emerald-400 font-black">({Number(act.total_amount || 0).toLocaleString("vi-VN")}đ)</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            CATEGORY TABS & SEARCH
            ========================================================================= */}
        <div id="products-section" className="pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-6 rounded-full bg-gradient-to-b from-blue-500 to-cyan-400" />
              <h2 className="text-lg font-black uppercase text-white tracking-tight">
                Danh Mục Sản Phẩm Chính Thức
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const active = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      active
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                        : "bg-[#161b22] text-gray-400 hover:text-white border border-gray-800 hover:border-gray-700"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* =========================================================================
            PRODUCTS CATALOG GRID (ShopRoblox Product Cards)
            ========================================================================= */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-80 rounded-2xl bg-[#161b22] border border-gray-800 animate-pulse" />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center bg-[#161b22] rounded-2xl border border-gray-800">
            <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-400">Không có sản phẩm nào trong danh mục này.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => {
              const currentVariant =
                selectedVariants[product.id] || (product.variants && product.variants[0]);
              const priceDisplay = currentVariant
                ? Number(currentVariant.price).toLocaleString("vi-VN") + "đ"
                : "Liên hệ";
              const originalPrice = currentVariant?.original_price;

              return (
                <div
                  key={product.id}
                  className="bg-[#161b22] rounded-2xl border border-gray-800 overflow-hidden shadow-xl hover:border-blue-500/50 transition-all duration-300 flex flex-col group"
                >
                  {/* Product Image Section */}
                  <div className="relative aspect-video bg-[#0d1117] overflow-hidden">
                    {product.badge && (
                      <div className="absolute top-2.5 left-2.5 z-20">
                        <span className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-2.5 py-1 rounded-lg text-[9px] font-black uppercase shadow-lg tracking-wider">
                          {product.badge}
                        </span>
                      </div>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-[#161b22] via-[#161b22]/70 to-transparent p-3 flex justify-between items-end">
                      <span className="text-[10px] text-gray-300 font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        Giao tự động 24/7
                      </span>
                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-800/60">
                        🟢 Còn hàng
                      </span>
                    </div>

                    <img
                      src={
                        product.thumbnail_url ||
                        (product.slug === "auto-rejoin-key"
                          ? "/banners/gamepassblox.png"
                          : "/banners/robux120H.png")
                      }
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        e.currentTarget.src = "/banners/gamepassblox.png";
                      }}
                    />
                  </div>

                  {/* Product Details Section */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <h3 className="font-black text-base text-white group-hover:text-cyan-400 transition-colors tracking-tight">
                        {product.name}
                      </h3>
                      <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed font-medium">
                        {product.short_description || product.description}
                      </p>
                    </div>

                    {/* Variant Selector */}
                    {product.variants && product.variants.length > 1 && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">
                          Chọn Gói / Thời Hạn:
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {product.variants.map((v) => {
                            const isSelected = currentVariant?.id === v.id;
                            return (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() =>
                                  setSelectedVariants((prev) => ({
                                    ...prev,
                                    [product.id]: v
                                  }))
                                }
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all text-left truncate ${
                                  isSelected
                                    ? "bg-blue-600/20 border-cyan-400 text-cyan-300 shadow-sm"
                                    : "bg-[#0d1117] border-gray-700 text-gray-400 hover:text-white"
                                }`}
                              >
                                {v.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Pricing and Action */}
                    <div className="pt-3 border-t border-gray-800/80 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase block">Giá bán</span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-black text-cyan-400 tracking-tight">
                            {priceDisplay}
                          </span>
                          {originalPrice && originalPrice > (currentVariant?.price || 0) && (
                            <span className="text-xs text-gray-500 line-through font-bold">
                              {Number(originalPrice).toLocaleString("vi-VN")}đ
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleOpenCheckout(product)}
                        className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-cyan-500/20 flex items-center gap-1.5 transition-all active:scale-95"
                      >
                        <Zap className="w-3.5 h-3.5 fill-white" />
                        Mua Ngay
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* =========================================================================
            FEATURE & TRUST HIGHLIGHTS (ShopRoblox)
            ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-6">
          <div className="bg-[#161b22] p-4 rounded-2xl border border-gray-800 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-cyan-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase text-white tracking-wide">Nhận Key 5 Giây</h4>
              <p className="text-[11px] text-gray-400 font-medium">Hệ thống gửi mã tự động tức thì</p>
            </div>
          </div>

          <div className="bg-[#161b22] p-4 rounded-2xl border border-gray-800 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase text-white tracking-wide">Bảo Hành 100%</h4>
              <p className="text-[11px] text-gray-400 font-medium">Đổi key mới nếu phát sinh lỗi</p>
            </div>
          </div>

          <div className="bg-[#161b22] p-4 rounded-2xl border border-gray-800 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase text-white tracking-wide">Đa Dạng Thanh Toán</h4>
              <p className="text-[11px] text-gray-400 font-medium">VietQR, MoMo & Thẻ Cào Viettel/Vina</p>
            </div>
          </div>

          <div className="bg-[#161b22] p-4 rounded-2xl border border-gray-800 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase text-white tracking-wide">Hỗ Trợ 24/7</h4>
              <p className="text-[11px] text-gray-400 font-medium">Giải đáp kỹ thuật qua Zalo/Discord</p>
            </div>
          </div>
        </div>
      </main>

      {/* =========================================================================
          ORDER / CHECKOUT MODAL (Strict Automated Verification - No Fake Buttons)
          ========================================================================= */}
      {checkoutModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#161b22] border border-gray-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden space-y-5">
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-cyan-400" />
                <h3 className="font-black text-base uppercase text-white tracking-tight">
                  {fulfilledOrder ? "Thanh Toán Thành Công!" : "Thanh Toán Đơn Hàng"}
                </h3>
              </div>
              <button
                onClick={() => setCheckoutModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* STEP 1: If Order not yet created */}
            {!activeOrder && !fulfilledOrder && (
              <form onSubmit={handleCreateOrder} className="space-y-4">
                <div className="bg-[#0d1117] p-3.5 rounded-2xl border border-gray-800 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <Package className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-sm text-white truncate">{selectedProduct.name}</h4>
                    <p className="text-xs text-gray-400">
                      Gói:{" "}
                      <span className="text-cyan-300 font-bold">
                        {selectedVariants[selectedProduct.id]?.name || "Tiêu chuẩn"}
                      </span>{" "}
                      -{" "}
                      <span className="text-emerald-400 font-black">
                        {Number(
                          selectedVariants[selectedProduct.id]?.price ||
                            selectedProduct.variants?.[0]?.price ||
                            0
                        ).toLocaleString("vi-VN")}
                        đ
                      </span>
                    </p>
                  </div>
                </div>

                {selectedProduct.slug === "reset-hwid" && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-cyan-400 uppercase tracking-wider block">
                      * Nhập License Key Cần Reset HWID:
                    </label>
                    <input
                      type="text"
                      required
                      value={targetHwidKey}
                      onChange={(e) => setTargetHwidKey(e.target.value)}
                      placeholder="VD: AUTO-ABCD-EFGH-1234"
                      className="w-full bg-[#0d1117] border border-cyan-500/50 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-white outline-none focus:border-cyan-400 tracking-wider"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">
                    Email / Discord nhận Key:
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="VD: robloxuser@gmail.com"
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-xl px-3.5 py-2.5 text-xs font-medium text-white outline-none focus:border-cyan-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={orderSubmitting}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  {orderSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang Tạo Đơn Hàng...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-white" />
                      Tiến Hành Thanh Toán
                    </>
                  )}
                </button>
              </form>
            )}

            {/* STEP 2: Order Created -> Automated QR & Real-time Server Polling */}
            {activeOrder && !fulfilledOrder && (
              <div className="space-y-4">
                <div className="bg-[#0d1117] p-4 rounded-2xl border border-gray-800 text-center space-y-3">
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                    Quét Mã VietQR Hoặc Chuyển Khoản Chính Xác
                  </span>

                  {/* VietQR Image */}
                  <div className="inline-block p-2 bg-white rounded-2xl shadow-xl">
                    <img
                      src={`https://api.vietqr.io/image/970422-0987654321-compact2.jpg?amount=${activeOrder.totalAmount}&addInfo=${activeOrder.transferContent}&accountName=AUTO%20REJOIN%20STORE`}
                      alt="VietQR"
                      className="w-48 h-48 object-contain mx-auto rounded-xl"
                    />
                  </div>

                  <div className="bg-[#161b22] p-3 rounded-xl border border-gray-800 text-left space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Số Tiền:</span>
                      <span className="font-black text-cyan-400 text-sm">
                        {Number(activeOrder.totalAmount).toLocaleString("vi-VN")}đ
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Nội Dung Chuyển Khoản:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-white bg-black/50 px-2 py-0.5 rounded border border-gray-700">
                          {activeOrder.transferContent}
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(activeOrder.transferContent);
                            setCopiedContent(true);
                            setTimeout(() => setCopiedContent(false), 2000);
                          }}
                          className="text-gray-400 hover:text-white p-1"
                          title="Sao chép nội dung"
                        >
                          {copiedContent ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Mã Đơn Hàng:</span>
                      <span className="font-mono text-gray-300">{activeOrder.orderCode}</span>
                    </div>
                  </div>
                </div>

                {/* Automated Polling Animation */}
                <div className="p-3 bg-blue-950/40 border border-blue-800/50 rounded-xl flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-cyan-400 animate-spin shrink-0" />
                  <div className="text-[11px]">
                    <p className="font-black text-white">Đang đợi xác nhận từ Ngân Hàng...</p>
                    <p className="text-gray-400">Hệ thống sẽ tự động giao key ngay khi nhận được tiền.</p>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Order Fulfilled / Delivery Screen */}
            {fulfilledOrder && (
              <div className="space-y-4 text-center animate-in zoom-in duration-300">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                  <Check className="w-7 h-7 stroke-[3]" />
                </div>

                <div>
                  <h4 className="font-black text-lg text-white uppercase tracking-tight">
                    Thanh Toán & Giao Key Thành Công!
                  </h4>
                  <p className="text-xs text-gray-400 font-medium mt-1">
                    Cảm ơn bạn đã tin tưởng sử dụng Auto Rejoin Pro.
                  </p>
                </div>

                {/* Fulfillments keys */}
                {fulfilledOrder.items && (
                  <div className="bg-[#0d1117] p-4 rounded-2xl border border-gray-800 text-left space-y-3">
                    {fulfilledOrder.items.map((item, idx) => (
                      <div key={idx} className="space-y-1.5">
                        <span className="text-[10px] font-black uppercase text-gray-400">
                          {item.product_name || "Bản Quyền Đã Cấp"}:
                        </span>
                        {item.fulfillment_data?.key ? (
                          <div className="flex items-center gap-2 bg-[#161b22] p-2.5 rounded-xl border border-gray-700">
                            <span className="font-mono font-black text-cyan-300 text-xs flex-1 break-all select-all">
                              {item.fulfillment_data.key}
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(item.fulfillment_data.key);
                                setCopiedKey(true);
                                setTimeout(() => setCopiedKey(false), 2000);
                              }}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shrink-0"
                            >
                              {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              {copiedKey ? "Đã chép" : "Copy Key"}
                            </button>
                          </div>
                        ) : (
                          <div className="bg-[#161b22] p-2.5 rounded-xl border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                            ✓ {item.fulfillment_data?.message || "Đã xử lý dịch vụ hoàn tất!"}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setCheckoutModalOpen(false)}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg"
                >
                  Hoàn Tất & Đóng
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          CARD TOP-UP RESULT MODAL (ShopRoblox 1-to-1)
          ========================================================================= */}
      {cardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#161b22] border border-gray-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4 relative">
            <button
              onClick={() => setCardModalOpen(false)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            {cardStatus === "submitting" && (
              <div className="py-6 space-y-3">
                <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto" />
                <h4 className="font-black text-sm text-white uppercase">Đang Gửi Thẻ Lên Hệ Thống</h4>
                <p className="text-xs text-gray-400">Vui lòng không đóng cửa sổ này...</p>
              </div>
            )}

            {cardStatus === "success" && (
              <div className="py-4 space-y-3 animate-in zoom-in duration-300">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <h4 className="font-black text-sm text-white uppercase">Gửi Thẻ Thành Công!</h4>
                <p className="text-xs text-gray-400">{cardResult?.message}</p>

                <div className="bg-[#0d1117] p-3 rounded-xl border border-gray-800 text-left text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Nhà mạng:</span>
                    <span className="font-bold text-white">{cardResult?.telco}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Mệnh giá:</span>
                    <span className="font-bold text-cyan-400">
                      {Number(cardResult?.amount).toLocaleString("vi-VN")}đ
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setCardModalOpen(false)}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg"
                >
                  Xác Nhận
                </button>
              </div>
            )}

            {cardStatus === "error" && (
              <div className="py-4 space-y-3 animate-in zoom-in duration-300">
                <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h4 className="font-black text-sm text-white uppercase">Nạp Thẻ Thất Bại</h4>
                <p className="text-xs text-rose-300">{cardResult?.message}</p>

                <button
                  onClick={() => setCardModalOpen(false)}
                  className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-black text-xs uppercase tracking-wider rounded-xl"
                >
                  Đóng
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Customer Authentication Modal (Login / Register) */}
      <CustomerAuthModal
        isOpen={authModalOpen}
        initialTab={authModalTab}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => {
          setAuthModalOpen(false);
        }}
      />

      {/* Global Marquee Styling */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee 28s linear infinite;
        }
        .animate-marquee-fast {
          animation: marquee 20s linear infinite;
        }
      `}</style>
    </div>
  );
}
