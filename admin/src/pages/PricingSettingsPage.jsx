import React, { useState, useEffect } from "react";
import {
  DollarSign,
  Save,
  RotateCcw,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  Eye,
  Sliders,
  Sparkles,
  Shield,
  Layers,
  HelpCircle
} from "lucide-react";
import { api } from "../api/client.js";
import { ConfirmActionModal } from "../components/ConfirmActionModal.jsx";

const DEFAULT_PRICING_PLANS = [
  {
    id: "trial_4h",
    name: "Dùng Thử 4 Giờ",
    badge: "Test",
    duration: "4 giờ",
    durationHours: 4,
    priceFormatted: "0",
    priceNumber: 0,
    plan: "basic",
    maxDevices: 1,
    enabled: false,
    highlight: false,
    description: "Key dùng thử 4 giờ do quản trị viên cấp để trải nghiệm nhanh.",
    features: [
      "1 máy kích hoạt",
      "1 clone chạy cùng lúc",
      "Hiệu lực trong 4 giờ",
      "Tự động kết nối lại khi crash/kick",
      "Tự động vào server ít người"
    ]
  },
  {
    id: "day",
    name: "1 Ngày",
    badge: "Dùng Thử",
    duration: "24 giờ",
    priceFormatted: "10,000",
    priceNumber: 10000,
    plan: "basic",
    maxDevices: 1,
    enabled: true,
    highlight: false,
    description: "Dành cho nhu cầu trải nghiệm nhanh hoặc chạy ngắn hạn.",
    features: [
      "1 máy kích hoạt",
      "1 clone chạy cùng lúc",
      "Tự động vào server ít người",
      "Anti-AFK chống kick cơ bản",
      "Tự động kết nối lại khi crash/kick"
    ]
  },
  {
    id: "week",
    name: "7 Ngày",
    badge: "Theo Tuần",
    duration: "7 ngày",
    priceFormatted: "40,000",
    priceNumber: 40000,
    plan: "standard",
    maxDevices: 1,
    enabled: true,
    highlight: false,
    description: "Gói tiết kiệm tuần cho nhu cầu treo farm và cảnh báo cơ bản.",
    features: [
      "1 máy kích hoạt",
      "Tối đa 5 clone chạy cùng lúc",
      "Tự động vào server ít người",
      "Cảnh báo thông báo qua Discord",
      "Hỗ trợ lưu cấu hình theo profile"
    ]
  },
  {
    id: "month",
    name: "30 Ngày",
    badge: "Phổ biến",
    duration: "30 ngày",
    priceFormatted: "100,000",
    priceNumber: 100000,
    plan: "pro",
    maxDevices: 2,
    enabled: true,
    highlight: true,
    description: "Gói tiêu chuẩn cho nhiều tài khoản và thiết bị chạy song song.",
    features: [
      "2 máy kích hoạt cùng lúc",
      "Tối đa 20 clone chạy cùng lúc",
      "Tự động vào server ít người",
      "Cảnh báo Discord & Profile cấu hình",
      "Hỗ trợ bộ cài Roblox tự động"
    ]
  },
  {
    id: "lifetime",
    name: "Trọn Đời",
    badge: "Vĩnh Viễn",
    duration: "Vĩnh viễn",
    priceFormatted: "250,000",
    priceNumber: 250000,
    plan: "business",
    maxDevices: 4,
    enabled: true,
    highlight: false,
    description: "Mua một lần, sử dụng dài hạn và mở khóa toàn bộ tính năng cao cấp.",
    features: [
      "4 máy kích hoạt cùng lúc",
      "Tối đa 100 clone chạy cùng lúc",
      "Đầy đủ tính năng gói Pro",
      "Mở khóa đa cửa sổ Freeform",
      "Hỗ trợ kỹ thuật ưu tiên 1-1"
    ]
  }
];

export function PricingSettingsPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  const loadPricing = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getPricing();
      setPlans(res.plans || []);
    } catch (err) {
      setError(err.message || "Không thể tải cấu hình bảng giá.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPricing();
  }, []);

  const handleFieldChange = (index, field, value) => {
    const updated = [...plans];
    updated[index] = { ...updated[index], [field]: value };
    setPlans(updated);
  };

  const handlePriceChange = (index, rawValue) => {
    const num = Number(rawValue.replace(/\D/g, "")) || 0;
    const updated = [...plans];
    updated[index] = {
      ...updated[index],
      priceNumber: num,
      priceFormatted: num.toLocaleString("vi-VN")
    };
    setPlans(updated);
  };

  const handleFeatureChange = (planIdx, featIdx, value) => {
    const updated = [...plans];
    const feats = [...(updated[planIdx].features || [])];
    feats[featIdx] = value;
    updated[planIdx].features = feats;
    setPlans(updated);
  };

  const handleAddFeature = (planIdx) => {
    const updated = [...plans];
    const feats = [...(updated[planIdx].features || []), "Tính năng mới"];
    updated[planIdx].features = feats;
    setPlans(updated);
  };

  const handleRemoveFeature = (planIdx, featIdx) => {
    const updated = [...plans];
    const feats = [...(updated[planIdx].features || [])];
    feats.splice(featIdx, 1);
    updated[planIdx].features = feats;
    setPlans(updated);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await api.updatePricing(plans);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err.message || "Không thể lưu bảng giá.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setConfirmModal({
      title: "Khôi phục bảng giá mặc định",
      description: "Bạn có chắc chắn muốn khôi phục toàn bộ giá, số thiết bị và tính năng của tất cả các gói về mặc định gốc?",
      confirmText: "Khôi phục mặc định",
      variant: "warning",
      action: () => {
        setPlans(DEFAULT_PRICING_PLANS);
        setConfirmModal(null);
      }
    });
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold uppercase tracking-wider">Đang tải cấu hình bảng giá...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Quản Lý Bảng Giá & Gói Cước</h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
              Live Sync
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Tùy chỉnh giá tiền (VNĐ), số lượng thiết bị, nhãn nổi bật và tính năng cho từng gói license bán trên Storefront.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleResetDefaults}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Khôi phục mặc định</span>
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{saving ? "Đang lưu..." : "Lưu Thay Đổi"}</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {saveSuccess && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Bảng giá đã được cập nhật thành công! Storefront và VietQR đã đồng bộ giá mới.</span>
        </div>
      )}
      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Plan Editor Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {plans.map((plan, idx) => (
          <div
            key={plan.id || idx}
            className={`rounded-2xl border p-5 space-y-4 bg-slate-900/60 backdrop-blur-sm transition-all ${
              plan.highlight
                ? "border-emerald-500/60 shadow-lg shadow-emerald-500/10"
                : "border-slate-800"
            }`}
          >
            {/* Header / Switch */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="font-bold text-sm text-white">{plan.name}</span>
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={plan.enabled !== false}
                  onChange={(e) => handleFieldChange(idx, "enabled", e.target.checked)}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500/30 bg-slate-950 w-3.5 h-3.5"
                />
                <span className="text-[11px] text-slate-400">Hiện Store</span>
              </label>
            </div>

            {/* Inputs */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Tên gói hiển thị
                </label>
                <input
                  type="text"
                  value={plan.name}
                  onChange={(e) => handleFieldChange(idx, "name", e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Giá tiền (VNĐ)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={plan.priceNumber?.toLocaleString("vi-VN") || "0"}
                    onChange={(e) => handlePriceChange(idx, e.target.value)}
                    className="w-full pl-3 pr-10 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-emerald-400 font-mono font-bold text-sm focus:outline-none focus:border-emerald-500"
                  />
                  <span className="absolute right-3 top-2 text-[11px] font-mono text-slate-500 font-semibold">
                    VNĐ
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Badge nhãn
                  </label>
                  <input
                    type="text"
                    value={plan.badge || ""}
                    placeholder="VD: Phổ biến"
                    onChange={(e) => handleFieldChange(idx, "badge", e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Thời hạn
                  </label>
                  <input
                    type="text"
                    value={plan.duration || ""}
                    placeholder="VD: 30 ngày"
                    onChange={(e) => handleFieldChange(idx, "duration", e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Số slot thiết bị
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={plan.maxDevices || 1}
                    onChange={(e) => handleFieldChange(idx, "maxDevices", Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Cấp hệ thống
                  </label>
                  <select
                    value={plan.plan || "pro"}
                    onChange={(e) => handleFieldChange(idx, "plan", e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-emerald-500 capitalize"
                  >
                    <option value="basic">Basic (1 clone)</option>
                    <option value="standard">Standard (5 clone)</option>
                    <option value="pro">Pro (20 clone)</option>
                    <option value="business">Business (100 clone)</option>
                  </select>
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-300 font-medium">
                  <input
                    type="checkbox"
                    checked={Boolean(plan.highlight)}
                    onChange={(e) => handleFieldChange(idx, "highlight", e.target.checked)}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500/30 bg-slate-950 w-3.5 h-3.5"
                  />
                  <span>Gói Nổi Bật (Featured Accent Glow)</span>
                </label>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Mô tả ngắn
                </label>
                <textarea
                  rows="2"
                  value={plan.description || ""}
                  onChange={(e) => handleFieldChange(idx, "description", e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-xs focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              {/* Features Editor */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-400">Dòng tính năng</span>
                  <button
                    type="button"
                    onClick={() => handleAddFeature(idx)}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Thêm</span>
                  </button>
                </div>

                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {plan.features?.map((feat, fIdx) => (
                    <div key={fIdx} className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={feat}
                        onChange={(e) => handleFeatureChange(idx, fIdx, e.target.value)}
                        className="flex-1 px-2 py-1 bg-slate-950 border border-slate-800/80 rounded text-[11px] text-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveFeature(idx, fIdx)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* In-App Confirmation Modal */}
      <ConfirmActionModal
        isOpen={Boolean(confirmModal)}
        onClose={() => setConfirmModal(null)}
        onConfirm={confirmModal?.action}
        title={confirmModal?.title}
        description={confirmModal?.description}
        confirmText={confirmModal?.confirmText}
        variant={confirmModal?.variant}
      />
    </div>
  );
}
