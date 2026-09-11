import React, { useState, useEffect } from "react";
import {
  Target,
  Search,
  Globe,
  Tag,
  Percent,
  Megaphone,
  CheckCircle2,
  AlertCircle,
  Save,
  Eye,
  BarChart3,
  Plus,
  Trash2,
  Sparkles,
  RefreshCw
} from "lucide-react";
import { api } from "../api/client.js";

const EMPTY_MARKETING_CONFIG = {
  gtmId: "",
  googleAdsId: "",
  googleAdsLabel: "",
  ga4Id: "",
  metaPixelId: "",
  tiktokPixelId: "",
  seoTitle: "Auto Rejoin Pro — Hệ Thống Auto Roblox & Treo Server Ít Người",
  seoDescription: "Tự động tìm server Roblox ít người, chống AFK 24/7 và quản lý thiết bị Roblox đa nền tảng Termux & Windows. Kích hoạt tự động VietQR sau thanh toán.",
  seoKeywords: "auto rejoin roblox, tool roblox it nguoi, auto treo roblox, anti afk roblox, tool auto termux roblox",
  canonicalUrl: "",
  promoBannerEnabled: false,
  promoBannerText: "🔥 FLASH SALE: Nhập mã giảm giá khi mua gói bất kỳ hôm nay!",
  promoBannerCountdown: "",
  socialProofEnabled: true
};

export function MarketingAdsPage() {
  const [config, setConfig] = useState(EMPTY_MARKETING_CONFIG);
  const [coupons, setCoupons] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState("google_ads"); // 'google_ads' | 'seo' | 'promotions' | 'coupons' | 'analytics'
  const [newCouponCode, setNewCouponCode] = useState("");
  const [newCouponDiscount, setNewCouponDiscount] = useState(15);
  const [newCouponMaxUses, setNewCouponMaxUses] = useState(100);

  useEffect(() => {
    loadRealData();
  }, []);

  const loadRealData = async () => {
    setLoading(true);
    try {
      // 1. Fetch real marketing config from database
      const res = await api.getSetting("google_ads_seo_config");
      if (res?.data) {
        setConfig((prev) => ({ ...prev, ...res.data }));
      }

      // 2. Fetch real coupons from database
      const coupRes = await api.getSetting("coupons_config");
      if (coupRes?.data && Array.isArray(coupRes.data)) {
        setCoupons(coupRes.data);
      } else {
        setCoupons([]);
      }

      // 3. Fetch real payment transactions from database
      const payRes = await api.listAdminPayments({ limit: 50 });
      if (payRes?.items && Array.isArray(payRes.items)) {
        setPayments(payRes.items);
      } else {
        setPayments([]);
      }
    } catch (err) {
      console.error("Failed to load marketing settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const showToastMsg = (msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveConfig = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      await api.setSetting("google_ads_seo_config", config);
      showToastMsg("Đã lưu cấu hình Google Ads & SEO vào cơ sở dữ liệu!");
    } catch (err) {
      showToastMsg(err.message || "Lỗi khi lưu cài đặt.", true);
    } finally {
      setSaving(false);
    }
  };

  const handleAddCoupon = async (e) => {
    e.preventDefault();
    if (!newCouponCode.trim()) return;

    const newCoupon = {
      id: Date.now(),
      code: newCouponCode.trim().toUpperCase(),
      discount: Number(newCouponDiscount) || 10,
      maxUses: Number(newCouponMaxUses) || 100,
      usedCount: 0,
      status: "active",
      createdAt: new Date().toISOString()
    };

    const updated = [newCoupon, ...coupons];
    setCoupons(updated);
    setNewCouponCode("");

    try {
      await api.setSetting("coupons_config", updated);
      showToastMsg(`Đã tạo mã giảm giá "${newCoupon.code}" trong database!`);
    } catch (err) {
      showToastMsg("Lỗi khi lưu mã giảm giá.", true);
    }
  };

  const handleDeleteCoupon = async (id) => {
    const updated = coupons.filter((c) => c.id !== id);
    setCoupons(updated);
    try {
      await api.setSetting("coupons_config", updated);
      showToastMsg("Đã xóa mã coupon khỏi cơ sở dữ liệu.");
    } catch (err) {
      showToastMsg("Lỗi khi cập nhật cơ sở dữ liệu.", true);
    }
  };

  // Compute real payment totals
  const totalPaidRevenue = payments
    .filter((p) => p.status === "completed" || p.status === "paid")
    .reduce((acc, cur) => acc + (Number(cur.amount) || 0), 0);
  const paidOrdersCount = payments.filter((p) => p.status === "completed" || p.status === "paid").length;

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <Target className="w-5 h-5 text-emerald-400" />
            <span>Google Ads & SEO Marketing Engine</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Cấu hình chuyển đổi thực tế, lưu trữ trực tiếp vào cơ sở dữ liệu MySQL để tối ưu chiến dịch quảng cáo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadRealData}
            disabled={loading}
            className="h-9 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Làm mới</span>
          </button>
          <button
            onClick={handleSaveConfig}
            disabled={saving}
            className="h-9 px-4 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
          >
            {saving ? (
              <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Lưu Cấu Hình Marketing</span>
          </button>
        </div>
      </div>

      {toast && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
            toast.isError
              ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
          }`}
        >
          {toast.isError ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* 2. Top Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("google_ads")}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === "google_ads"
              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
              : "text-slate-400 hover:text-white hover:bg-slate-800/50"
          }`}
        >
          <Target className="w-3.5 h-3.5 text-emerald-400" />
          <span>Google Ads & Conversion Tracking</span>
        </button>

        <button
          onClick={() => setActiveTab("seo")}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === "seo"
              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
              : "text-slate-400 hover:text-white hover:bg-slate-800/50"
          }`}
        >
          <Search className="w-3.5 h-3.5 text-cyan-400" />
          <span>SEO Lên Top Google</span>
        </button>

        <button
          onClick={() => setActiveTab("promotions")}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === "promotions"
              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
              : "text-slate-400 hover:text-white hover:bg-slate-800/50"
          }`}
        >
          <Megaphone className="w-3.5 h-3.5 text-amber-400" />
          <span>Thanh Khuyến Mại & Flash Sale</span>
        </button>

        <button
          onClick={() => setActiveTab("coupons")}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === "coupons"
              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
              : "text-slate-400 hover:text-white hover:bg-slate-800/50"
          }`}
        >
          <Tag className="w-3.5 h-3.5 text-purple-400" />
          <span>Mã Giảm Giá ({coupons.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("analytics")}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === "analytics"
              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
              : "text-slate-400 hover:text-white hover:bg-slate-800/50"
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 text-teal-400" />
          <span>Thống Kê Đơn Hàng Thực Nhận</span>
        </button>
      </div>

      {/* 3. TAB 1: GOOGLE ADS & TRACKING TAGS */}
      {activeTab === "google_ads" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Google Ads Conversion Box */}
          <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-4">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">Google Ads Conversion Tracking</h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Khai báo ID và Label chuyển đổi để Google Ads tối ưu hóa giá thầu (Target CPA) khi khách mua key thành công.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Google Ads Conversion ID:
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: AW-114829104"
                  value={config.googleAdsId || ""}
                  onChange={(e) => setConfig({ ...config, googleAdsId: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg bg-black/50 border border-slate-700 text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Conversion Label (Sự kiện Mua License):
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: c_Rejoin_Purchase_VN"
                  value={config.googleAdsLabel || ""}
                  onChange={(e) => setConfig({ ...config, googleAdsLabel: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg bg-black/50 border border-slate-700 text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="p-3 bg-emerald-950/30 border border-emerald-500/20 rounded-lg text-emerald-300 text-[11px]">
                ✓ Hệ thống tự động kích hoạt sự kiện chuyển đổi kèm giá trị thực tế sau khi giao dịch VietQR được xác thực.
              </div>
            </div>
          </div>

          {/* GTM & GA4 & Social Pixels */}
          <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-bold text-white">Google Tag Manager & Analytics</h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Theo dõi lưu lượng khách truy cập, tỷ lệ chuyển đổi và tiếp thị lại (Remarketing).
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Google Tag Manager (GTM ID):
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: GTM-XXXXXXX"
                  value={config.gtmId || ""}
                  onChange={(e) => setConfig({ ...config, gtmId: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg bg-black/50 border border-slate-700 text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Google Analytics 4 (GA4 Measurement ID):
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: G-XXXXXXXXXX"
                  value={config.ga4Id || ""}
                  onChange={(e) => setConfig({ ...config, ga4Id: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg bg-black/50 border border-slate-700 text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">Meta Pixel ID:</label>
                  <input
                    type="text"
                    placeholder="Pixel ID"
                    value={config.metaPixelId || ""}
                    onChange={(e) => setConfig({ ...config, metaPixelId: e.target.value })}
                    className="w-full h-8 px-2.5 rounded bg-black/50 border border-slate-700 text-white font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">TikTok Pixel ID:</label>
                  <input
                    type="text"
                    placeholder="Pixel ID"
                    value={config.tiktokPixelId || ""}
                    onChange={(e) => setConfig({ ...config, tiktokPixelId: e.target.value })}
                    className="w-full h-8 px-2.5 rounded bg-black/50 border border-slate-700 text-white font-mono text-[11px]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. TAB 2: SEO META ENGINE */}
      {activeTab === "seo" && (
        <div className="space-y-5">
          {/* SEO Form */}
          <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-4">
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Search className="w-4 h-4 text-emerald-400" />
                <span>Cấu Hình Thẻ Meta Tối Ưu Lên Top Google</span>
              </h2>
              <p className="text-xs text-slate-400">
                Chuẩn hóa cấu trúc SEO On-page để đạt điểm chất lượng cao khi chạy Google Search Ads.
              </p>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Tiêu đề trang (SEO Meta Title - Tối đa 65 ký tự):
                </label>
                <input
                  type="text"
                  value={config.seoTitle || ""}
                  onChange={(e) => setConfig({ ...config, seoTitle: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg bg-black/50 border border-slate-700 text-white font-medium focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Độ dài hiện tại: {(config.seoTitle || "").length} / 65 ký tự
                </span>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Mô tả bài viết (Meta Description - Tối đa 160 ký tự):
                </label>
                <textarea
                  rows={3}
                  value={config.seoDescription || ""}
                  onChange={(e) => setConfig({ ...config, seoDescription: e.target.value })}
                  className="w-full p-3 rounded-lg bg-black/50 border border-slate-700 text-white font-medium focus:outline-none focus:border-emerald-500 leading-relaxed"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Độ dài hiện tại: {(config.seoDescription || "").length} / 160 ký tự
                </span>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Từ khóa mục tiêu (Focus Keywords):
                </label>
                <input
                  type="text"
                  value={config.seoKeywords || ""}
                  onChange={(e) => setConfig({ ...config, seoKeywords: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg bg-black/50 border border-slate-700 text-white font-mono text-[11px] focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Google Search Live Preview */}
          <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
              <span>Xem Trước Kết Quả Tìm Kiếm Google (Snippet Preview)</span>
            </h3>

            <div className="p-4 bg-white text-slate-900 rounded-xl shadow-md max-w-2xl font-sans space-y-1">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px]">
                  AR
                </div>
                <div>
                  <p className="font-medium text-slate-900">Auto Rejoin Pro</p>
                  <p className="text-[11px] text-slate-500">https://autorejoin.pro</p>
                </div>
              </div>

              <h4 className="text-base font-semibold text-[#1a0dab] hover:underline cursor-pointer leading-snug">
                {config.seoTitle}
              </h4>

              <p className="text-xs text-[#4d5156] leading-relaxed line-clamp-2">
                {config.seoDescription}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB 3: PROMO BANNER & FLASH SALE */}
      {activeTab === "promotions" && (
        <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-amber-400" />
                <span>Thanh Thông Báo Flash Sale Trên Đầu Trang (Storefront)</span>
              </h2>
              <p className="text-xs text-slate-400">
                Hiển thị banner khuyến mại trên Storefront để tăng tỷ lệ click mua hàng từ Google Ads.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={Boolean(config.promoBannerEnabled)}
              onClick={() => setConfig({ ...config, promoBannerEnabled: !config.promoBannerEnabled })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                config.promoBannerEnabled ? "bg-emerald-500" : "bg-slate-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  config.promoBannerEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="space-y-3.5 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Nội dung dòng thông báo / Khuyến mại:
              </label>
              <input
                type="text"
                value={config.promoBannerText || ""}
                onChange={(e) => setConfig({ ...config, promoBannerText: e.target.value })}
                className="w-full h-9 px-3 rounded-lg bg-black/50 border border-slate-700 text-white font-medium focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Live Preview */}
            <div>
              <span className="block text-slate-400 font-semibold mb-1 text-[11px]">
                Xem trước thanh banner trên web:
              </span>
              <div className="p-2.5 rounded-lg bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-200 text-xs text-center font-medium flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{config.promoBannerText || "Chưa có nội dung"}</span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-800">
              <span className="text-slate-300 font-semibold">Bật thông báo khách vừa mua (Social Proof Toasts):</span>
              <input
                type="checkbox"
                checked={config.socialProofEnabled || false}
                onChange={(e) => setConfig({ ...config, socialProofEnabled: e.target.checked })}
                className="rounded bg-black border-slate-700 text-emerald-500 w-4 h-4"
              />
            </div>
          </div>
        </div>
      )}

      {/* 6. TAB 4: COUPONS & DISCOUNT CODES */}
      {activeTab === "coupons" && (
        <div className="space-y-5">
          {/* Create Coupon Card */}
          <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Tag className="w-4 h-4 text-purple-400" />
              <span>Tạo Mã Giảm Giá Mới Trong Database</span>
            </h2>

            <form onSubmit={handleAddCoupon} className="flex flex-col sm:flex-row gap-3 text-xs">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Mã giảm giá (ví dụ: GOOGLE20)..."
                  value={newCouponCode}
                  onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
                  className="w-full h-9 px-3 rounded-lg bg-black/50 border border-slate-700 text-white font-mono uppercase focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="w-32">
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="90"
                    placeholder="Giảm (%)"
                    value={newCouponDiscount}
                    onChange={(e) => setNewCouponDiscount(e.target.value)}
                    className="w-full h-9 pl-3 pr-7 rounded-lg bg-black/50 border border-slate-700 text-white font-mono focus:outline-none focus:border-emerald-500"
                    required
                  />
                  <Percent className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="w-32">
                <input
                  type="number"
                  min="1"
                  placeholder="Số lượt dùng"
                  value={newCouponMaxUses}
                  onChange={(e) => setNewCouponMaxUses(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-black/50 border border-slate-700 text-white font-mono focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <button
                type="submit"
                className="h-9 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Mã Giảm</span>
              </button>
            </form>
          </div>

          {/* Coupon Table */}
          <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Danh Sách Mã Giảm Giá Trong Database ({coupons.length})
            </h3>

            {coupons.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                      <th className="pb-2.5 font-semibold">MÃ COUPON</th>
                      <th className="pb-2.5 font-semibold">MỨC GIẢM</th>
                      <th className="pb-2.5 font-semibold">LƯỢT ĐÃ DÙNG</th>
                      <th className="pb-2.5 font-semibold">TRẠNG THÁI</th>
                      <th className="pb-2.5 font-semibold text-right">THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {coupons.map((coupon) => (
                      <tr key={coupon.id} className="hover:bg-slate-800/30">
                        <td className="py-3 font-bold text-emerald-400">{coupon.code}</td>
                        <td className="py-3 text-white">Giảm {coupon.discount}%</td>
                        <td className="py-3 text-slate-400">{coupon.usedCount || 0} / {coupon.maxUses} lượt</td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              coupon.status === "active"
                                ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {coupon.status === "active" ? "Đang bật" : "Đã tắt"}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => handleDeleteCoupon(coupon.id)}
                            className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-slate-500 bg-black/20 rounded-lg border border-slate-800/60">
                Chưa có mã giảm giá nào được tạo. Hãy tạo mã coupon đầu tiên ở bảng trên.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. TAB 5: REAL PAYMENT & ORDER METRICS */}
      {activeTab === "analytics" && (
        <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <span>Thống Kê Đơn Hàng & Giao Dịch Thực Nhận Từ Database</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Dữ liệu thanh toán thực tế được tổng hợp từ bảng payments MySQL.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pb-2">
            <div className="p-4 bg-black/40 border border-slate-800 rounded-xl">
              <span className="text-[11px] font-mono text-slate-400">DOANH THU THỰC NHẬN</span>
              <p className="text-xl font-bold font-mono text-emerald-400 mt-1">
                {totalPaidRevenue.toLocaleString("vi-VN")} đ
              </p>
            </div>

            <div className="p-4 bg-black/40 border border-slate-800 rounded-xl">
              <span className="text-[11px] font-mono text-slate-400">ĐƠN ĐÃ THANH TOÁN THÀNH CÔNG</span>
              <p className="text-xl font-bold font-mono text-white mt-1">{paidOrdersCount}</p>
            </div>

            <div className="p-4 bg-black/40 border border-slate-800 rounded-xl">
              <span className="text-[11px] font-mono text-slate-400">TỔNG GIAO DỊCH GHI NHẬN</span>
              <p className="text-xl font-bold font-mono text-slate-300 mt-1">{payments.length}</p>
            </div>
          </div>

          {payments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                    <th className="pb-3 font-semibold">MÃ ĐƠN</th>
                    <th className="pb-3 font-semibold">MÃ CHUYỂN KHOẢN</th>
                    <th className="pb-3 font-semibold">GÓI CƯỚC</th>
                    <th className="pb-3 font-semibold">SỐ TIỀN</th>
                    <th className="pb-3 font-semibold">TRẠNG THÁI</th>
                    <th className="pb-3 font-semibold text-right">THỜI GIAN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {payments.slice(0, 10).map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 font-bold text-white">{p.orderCode}</td>
                      <td className="py-2.5 text-emerald-400">{p.transferContent}</td>
                      <td className="py-2.5 text-slate-300">{p.planName || p.planId}</td>
                      <td className="py-2.5 font-bold text-white">
                        {Number(p.amount).toLocaleString("vi-VN")} đ
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.status === "completed" || p.status === "paid"
                              ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30"
                              : "bg-amber-950/60 text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          {p.status === "completed" || p.status === "paid" ? "Đã thanh toán" : "Chờ thanh toán"}
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-slate-400">
                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString("vi-VN") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-slate-500 bg-black/20 rounded-lg border border-slate-800/60">
              Chưa có giao dịch thanh toán nào được ghi nhận trong cơ sở dữ liệu.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
