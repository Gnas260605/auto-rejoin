import { useState, useEffect } from "react";
import {
  X,
  User,
  Phone,
  Calendar,
  Monitor,
  Check,
  Copy,
  Zap,
  Send,
  MessageSquare,
  Shield,
  ExternalLink,
  FileText
} from "lucide-react";
import { api } from "../api/client";

const CHANNEL_OPTIONS = [
  { id: "zalo", label: "Zalo", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { id: "facebook", label: "Facebook / Messenger", color: "bg-sky-500/20 text-sky-400 border-sky-500/30" },
  { id: "telegram", label: "Telegram", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  { id: "shopee", label: "Shopee", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  { id: "direct", label: "Trực tiếp / Khác", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" }
];

const PRESET_PLANS = [
  { id: "trial_4h", label: "Dùng thử 4 giờ", plan: "basic", hours: 4, days: null, devices: 1, desc: "Key test nhanh 4 tiếng" },
  { id: "trial_1d", label: "1 Ngày (Thử nghiệm)", plan: "basic", days: 1, devices: 1, desc: "Trải nghiệm nhanh" },
  { id: "week_7d", label: "7 Ngày (1 Tuần)", plan: "basic", days: 7, devices: 1, desc: "Gói cơ bản ngắn hạn" },
  { id: "month_30d", label: "30 Ngày (1 Tháng)", plan: "pro", days: 30, devices: 2, popular: true, desc: "Bán chạy nhất (Pro)" },
  { id: "lifetime", label: "Vĩnh Viễn (Trọn Đời)", plan: "business", days: 0, devices: 4, desc: "Lifetime không giới hạn" },
  { id: "custom", label: "Tùy chỉnh số ngày", plan: "pro", days: null, devices: 1, desc: "Nhập ngày theo yêu cầu" }
];

export default function DirectSaleModal({ isOpen, onClose, onSuccess, initialLicenseId = null }) {
  const [step, setStep] = useState("form"); // "form" | "success" | "view_handover"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);

  // Form State
  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [salesChannel, setSalesChannel] = useState("zalo");
  const [customerNote, setCustomerNote] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("month_30d");
  const [customDays, setCustomDays] = useState(30);
  const [maxDevices, setMaxDevices] = useState(2);
  const [planType, setPlanType] = useState("pro");
  const [placeId, setPlaceId] = useState("107778070777162");

  // Result State
  const [createdData, setCreatedData] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setCopiedKey(false);
      setCopiedMsg(false);

      if (initialLicenseId) {
        // Load existing handover template
        setStep("view_handover");
        loadExistingHandover(initialLicenseId);
      } else {
        setStep("form");
        setCustomerName("");
        setCustomerContact("");
        setSalesChannel("zalo");
        setCustomerNote("");
        setSelectedPreset("month_30d");
        setCustomDays(30);
        setMaxDevices(2);
        setPlanType("pro");
        setPlaceId("107778070777162");
      }
    }
  }, [isOpen, initialLicenseId]);

  const loadExistingHandover = async (id) => {
    try {
      setLoading(true);
      const res = await api.getHandoverTemplate(id);
      setCreatedData({
        licenseId: res.licenseId,
        customerName: res.customerName,
        handoverTemplate: res.handoverTemplate,
        isExisting: true
      });
    } catch (err) {
      setError(err.message || "Không thể tải mẫu bàn giao");
    } finally {
      setLoading(false);
    }
  };

  const handlePresetChange = (presetId) => {
    setSelectedPreset(presetId);
    const preset = PRESET_PLANS.find((p) => p.id === presetId);
    if (!preset) return;

    if (presetId !== "custom") {
      setPlanType(preset.plan);
      setCustomDays(preset.days);
      setMaxDevices(preset.devices);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const isCustom = selectedPreset === "custom";
      const days = isCustom ? Number(customDays) : PRESET_PLANS.find((p) => p.id === selectedPreset)?.days;
      const selectedPlanObj = PRESET_PLANS.find((p) => p.id === selectedPreset);

      const payload = {
        customerName: customerName.trim() || "Khách hàng cá nhân",
        customerContact: customerContact.trim(),
        salesChannel,
        customerNote: customerNote.trim(),
        plan: isCustom ? planType : selectedPlanObj?.plan || "pro",
        planName: selectedPlanObj?.label || "Gói Pro Tùy Chỉnh",
        placeId: placeId.trim(),
        maxDevices: Number(maxDevices) || 1,
        expiresInHours: selectedPlanObj?.hours || null,
        expiresInDays: selectedPlanObj?.hours ? null : (days === 0 ? null : (days || 30))
      };

      const result = await api.createDirectSaleLicense(payload);
      setCreatedData(result);
      setStep("success");
      if (onSuccess) onSuccess(result);
    } catch (err) {
      setError(err.message || "Lỗi khi tạo mã Key bán lẻ");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, type) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === "key") {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else {
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-[#0B132B] border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-400 border border-emerald-500/30">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-wide">
                {step === "form" ? "Bán Key Nhanh Cho Khách Cá Nhân" : "Mẫu Bàn Giao Key Cho Khách"}
              </h3>
              <p className="text-xs text-slate-400">
                {step === "form"
                  ? "Tạo mã License tức thì & tự động sinh tin nhắn bàn giao"
                  : "Sao chép tin nhắn để gửi ngay qua Zalo, Messenger, Telegram"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center gap-2">
              <span className="font-semibold">Lỗi:</span> {error}
            </div>
          )}

          {step === "form" ? (
            <form id="direct-sale-form" onSubmit={handleSubmit} className="space-y-5">
              {/* Customer Info Section */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Thông tin khách hàng
                  </span>
                  <span className="text-[11px] text-slate-400">Lưu vào hệ thống để tra cứu & bảo hành</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-300 mb-1 font-medium">
                      Tên khách hàng <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="VD: Anh Nam (Zalo), Hùng Pro..."
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700/70 text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1 font-medium">
                      Số điện thoại / Nickname liên hệ
                    </label>
                    <input
                      type="text"
                      placeholder="VD: 0988xxx, fb.com/nam123..."
                      value={customerContact}
                      onChange={(e) => setCustomerContact(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700/70 text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1.5 font-medium">Kênh bán</label>
                  <div className="flex flex-wrap gap-2">
                    {CHANNEL_OPTIONS.map((ch) => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => setSalesChannel(ch.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                          salesChannel === ch.id
                            ? `${ch.color} ring-1 ring-cyan-400`
                            : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        {ch.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <label className="block text-xs text-slate-300 font-medium">
                  Place ID game cho lenh all-in-one
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{3,20}"
                  required
                  placeholder="VD: 107778070777162"
                  value={placeId}
                  onChange={(e) => setPlaceId(e.target.value.replace(/\D/g, ""))}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700/70 text-white text-sm font-mono focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition"
                />
                <p className="text-[11px] text-slate-400">
                  Lenh giao khach se gan Place ID nay voi license key moi tao.
                </p>
              </div>

              {/* Plan Selection */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Gói cước & Thời hạn
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PRESET_PLANS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handlePresetChange(preset.id)}
                      className={`relative p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                        selectedPreset === preset.id
                          ? "bg-gradient-to-br from-cyan-950/40 to-slate-900 border-cyan-500/80 ring-1 ring-cyan-500"
                          : "bg-slate-950/50 border-slate-800 hover:border-slate-700 text-slate-300"
                      }`}
                    >
                      {preset.popular && (
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          Khuyên dùng
                        </span>
                      )}
                      <div>
                        <div className="text-sm font-semibold text-white">{preset.label}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{preset.desc}</div>
                      </div>
                      <div className="mt-2 text-[11px] text-cyan-400 font-mono">
                        {preset.days === 0 ? "Vĩnh viễn" : preset.days ? `${preset.days} ngày` : "Tự chọn"} • {preset.devices || maxDevices} máy
                      </div>
                    </button>
                  ))}
                </div>

                {/* Custom Days & Device Settings */}
                {selectedPreset === "custom" && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                    <div>
                      <label className="block text-xs text-slate-300 mb-1">Số ngày sử dụng</label>
                      <input
                        type="number"
                        min="1"
                        max="3650"
                        value={customDays}
                        onChange={(e) => setCustomDays(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-300 mb-1">Hạng gói</label>
                      <select
                        value={planType}
                        onChange={(e) => setPlanType(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm"
                      >
                        <option value="basic">Basic (Cơ bản)</option>
                        <option value="pro">Pro (Đầy đủ tính năng)</option>
                        <option value="business">Business / VIP</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-between border-t border-slate-800/80">
                  <label className="text-xs text-slate-300 flex items-center gap-1.5 font-medium">
                    <Monitor className="w-3.5 h-3.5 text-slate-400" /> Giới hạn thiết bị chạy đồng thời:
                  </label>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 4, 8].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setMaxDevices(num)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition ${
                          maxDevices === num
                            ? "bg-cyan-500 text-slate-950"
                            : "bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs text-slate-300 mb-1 font-medium">
                  Ghi chú nội bộ (Đã thanh toán / STK / Mã giao dịch...)
                </label>
                <input
                  type="text"
                  placeholder="VD: Đã ck 150k Vietcombank lúc 14:30..."
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700/70 text-white text-sm focus:border-cyan-500 outline-none"
                />
              </div>
            </form>
          ) : (
            /* Handover / Result View */
            <div className="space-y-4 animate-fade-in">
              {/* Visual Card */}
              {createdData?.rawKey && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-[#0E1A38] to-slate-900 border border-cyan-500/40 shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold tracking-wider uppercase text-cyan-400 flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5" /> License Key đã tạo thành công
                    </span>
                    <span className="text-xs text-slate-400">👤 {createdData.customerName}</span>
                  </div>

                  <div className="flex items-center justify-between bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                    <code className="text-base font-mono font-bold text-emerald-400 tracking-wider">
                      {createdData.rawKey}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(createdData.rawKey, "key")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-xs font-semibold transition"
                    >
                      {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedKey ? "Đã chép Key" : "Chép Key"}
                    </button>
                  </div>
                </div>
              )}

              {createdData?.allInOneCommand && (
                <div className="p-3.5 rounded-xl bg-slate-950/90 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-400">
                      Lenh all-in-one gom Place ID + Key
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(createdData.allInOneCommand, "msg")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-xs font-semibold transition"
                    >
                      {copiedMsg ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedMsg ? "Da copy" : "Copy lenh"}
                    </button>
                  </div>
                  <code className="block p-3 rounded-lg bg-black/80 border border-slate-800 text-[11px] text-emerald-300 font-mono break-all select-all">
                    {createdData.allInOneCommand}
                  </code>
                </div>
              )}

              {/* Handover Message Box */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-cyan-400" /> Tin nhắn bàn giao hoàn chỉnh (Gửi cho khách)
                  </label>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(createdData?.handoverTemplate, "msg")}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
                  >
                    {copiedMsg ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedMsg ? "Đã sao chép toàn bộ" : "Sao chép tất cả"}
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={11}
                  value={createdData?.handoverTemplate || ""}
                  className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-700/80 font-mono text-xs text-slate-200 focus:outline-none leading-relaxed select-all"
                />
              </div>

              {/* Customer portal hint */}
              <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-500/20 text-xs text-cyan-300 flex items-center justify-between">
                <span>Khách có thể tự vào tra cứu hạn dùng & đổi thiết bị tại Cổng tự phục vụ.</span>
                <a
                  href="/portal"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-white hover:underline font-semibold"
                >
                  Mở Portal <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-700/50 bg-slate-900/50 flex items-center justify-between">
          {step === "form" ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg transition"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                form="direct-sale-form"
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold text-sm hover:from-emerald-400 hover:to-cyan-400 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    Đang tạo Key...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Tạo Key & Xuất Mẫu Giao Khách
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setStep("form");
                  setCreatedData(null);
                }}
                className="px-4 py-2 text-sm text-slate-300 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 transition"
              >
                + Bán thêm đơn khác
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyToClipboard(createdData?.handoverTemplate, "msg")}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-sm hover:bg-cyan-400 shadow-lg shadow-cyan-500/20 transition"
                >
                  {copiedMsg ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedMsg ? "Đã chép tin nhắn!" : "Sao chép tin nhắn gửi khách"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg transition"
                >
                  Đóng
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
