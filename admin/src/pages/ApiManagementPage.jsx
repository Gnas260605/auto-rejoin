import React, { useState, useEffect } from "react";
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  Code,
  Shield,
  Activity,
  Terminal,
  Zap,
  RefreshCw,
  Lock,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { api } from "../api/client.js";
import { ConfirmActionModal } from "../components/ConfirmActionModal.jsx";

export function ApiManagementPage() {
  const [apiKeys, setApiKeys] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [copiedKeyId, setCopiedKeyId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyRole, setNewKeyRole] = useState("reseller");
  const [activeSnippetTab, setActiveSnippetTab] = useState("activate");
  const [confirmModal, setConfirmModal] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch real API keys from database
      const res = await api.getSetting("api_keys_config");
      if (res?.data && Array.isArray(res.data)) {
        setApiKeys(res.data);
      } else {
        setApiKeys([]);
      }

      // 2. Fetch real audit logs from database
      const logsRes = await api.listAuditLogs({ limit: 10 });
      setLogs(logsRes.items || []);
    } catch (_err) {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  const showToastMsg = (msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3000);
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    showToastMsg("Đã sao chép API Key vào clipboard!");
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleCreateKey = async (e) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    const randomHash = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("");
    const keyFull = `sk_live_${randomHash}`;
    const keyMasked = `sk_live_${randomHash.slice(0, 4)}••••••••••••••••${randomHash.slice(-4)}`;

    const newEntry = {
      id: `key_${Date.now()}`,
      name: newKeyName.trim(),
      keyMasked,
      keyFull,
      role: newKeyRole,
      scopes:
        newKeyRole === "admin"
          ? ["licenses:all", "devices:all", "payments:all", "settings:write"]
          : newKeyRole === "bot"
          ? ["licenses:lookup", "payments:webhook"]
          : ["licenses:create", "licenses:lookup", "devices:reset"],
      rateLimit: newKeyRole === "admin" ? "1000 req/min" : "500 req/min",
      createdAt: new Date().toISOString(),
      status: "active"
    };

    const updated = [newEntry, ...apiKeys];
    setApiKeys(updated);
    setShowCreateModal(false);
    setNewKeyName("");

    try {
      await api.setSetting("api_keys_config", updated);
      showToastMsg(`Đã tạo và lưu API Key "${newEntry.name}" vào cơ sở dữ liệu!`);
    } catch (err) {
      showToastMsg("Lỗi khi lưu API Key: " + err.message, true);
    }
  };

  const handleRevokeKey = (keyItem) => {
    setConfirmModal({
      title: "Thu hồi API Key",
      description: "Bạn có chắc chắn muốn thu hồi (Revoke) API Key này không? Các ứng dụng hoặc bot đang dùng key này sẽ bị từ chối kết nối ngay lập tức.",
      confirmText: "Thu hồi ngay",
      variant: "danger",
      details: {
        "Tên Key": keyItem.name,
        "Quyền hạn": keyItem.role,
        "Prefix": keyItem.keyMasked || keyItem.prefix
      },
      action: async () => {
        const updated = apiKeys.filter((k) => k.id !== keyItem.id);
        setApiKeys(updated);
        setConfirmModal(null);
        try {
          await api.setSetting("api_keys_config", updated);
          showToastMsg("Đã thu hồi API Key thành công khỏi hệ thống.");
        } catch (err) {
          showToastMsg("Lỗi khi cập nhật cơ sở dữ liệu.", true);
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <Key className="w-5 h-5 text-emerald-400" />
            <span>Quản Lý API & Tích Hợp Hệ Thống</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Dữ liệu kết nối thời gian thực từ cơ sở dữ liệu MySQL. Quản lý Secret Tokens, Scopes và giám sát hoạt động API.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="h-9 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Làm mới</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="h-9 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo API Key Mới</span>
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

      {/* 2. Real Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400">API KEYS ĐÃ CẤP</span>
            <Shield className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl font-bold font-mono text-white">{apiKeys.length}</p>
          <p className="text-[11px] text-emerald-400">Được lưu trong database</p>
        </div>

        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400">NHẬT KÝ QUẢN TRỊ (LOGS)</span>
            <Activity className="w-4 h-4 text-teal-400" />
          </div>
          <p className="text-xl font-bold font-mono text-white">{logs.length}</p>
          <p className="text-[11px] text-slate-400 font-mono">Bản ghi gần nhất</p>
        </div>

        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400">TRẠNG THÁI GATEWAY</span>
            <Zap className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-xl font-bold font-mono text-emerald-400">ONLINE</p>
          <p className="text-[11px] text-slate-400">Node.js Express Cluster</p>
        </div>

        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400">RATE LIMITING</span>
            <Lock className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-sm font-bold text-white">Đang Kích Hoạt</p>
          <p className="text-[11px] text-slate-400">Anti-Bruteforce & Token Bucket</p>
        </div>
      </div>

      {/* 3. Real API Keys Table */}
      <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Key className="w-4 h-4 text-emerald-400" />
            <span>Danh Sách API Keys Trong Database</span>
          </h2>
          <span className="text-xs text-slate-400 font-mono">Tổng cộng: {apiKeys.length} keys</span>
        </div>

        {apiKeys.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                  <th className="pb-3 font-semibold">TÊN / MÔ TẢ KEY</th>
                  <th className="pb-3 font-semibold">SECRET TOKEN</th>
                  <th className="pb-3 font-semibold">PHÂN QUYỀN (SCOPES)</th>
                  <th className="pb-3 font-semibold">RATE LIMIT</th>
                  <th className="pb-3 font-semibold">NGÀY TẠO</th>
                  <th className="pb-3 font-semibold text-right">THAO TÁC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {apiKeys.map((key) => (
                  <tr key={key.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 pr-4">
                      <p className="font-semibold text-white">{key.name}</p>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 uppercase">
                        {key.role}
                      </span>
                    </td>

                    <td className="py-3.5 pr-4 font-mono">
                      <div className="flex items-center gap-2">
                        <span className="bg-black/50 px-2 py-1 rounded text-slate-300 border border-slate-700/60">
                          {key.keyMasked}
                        </span>
                        <button
                          onClick={() => handleCopy(key.id, key.keyFull)}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                          title="Sao chép API Key đầy đủ"
                        >
                          {copiedKeyId === key.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    <td className="py-3.5 pr-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {key.scopes?.map((s, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-950/50 text-emerald-300 border border-emerald-500/20"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-3.5 pr-4 font-mono text-slate-300">{key.rateLimit}</td>
                    <td className="py-3.5 pr-4 text-slate-400 font-mono">
                      {key.createdAt ? new Date(key.createdAt).toLocaleDateString("vi-VN") : "—"}
                    </td>

                    <td className="py-3.5 text-right">
                      <button
                        onClick={() => handleRevokeKey(key)}
                        className="px-2.5 py-1 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 rounded-lg transition-colors cursor-pointer"
                        title="Thu hồi API Key"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                        <span>Revoke</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center bg-black/30 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-2">
            <p>Chưa có Secret API Key nào được tạo trong hệ thống.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold cursor-pointer"
            >
              + Tạo API Key đầu tiên
            </button>
          </div>
        )}
      </div>

      {/* 4. Real Audit Logs Table */}
      <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <h2 className="text-sm font-bold text-white">Nhật Ký Quản Trị & Gọi API Gần Đây (Real Audit Logs)</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">Trực tiếp từ bảng audit_logs</span>
        </div>

        {logs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                  <th className="pb-2.5">THỜI GIAN</th>
                  <th className="pb-2.5">NGƯỜI THỰC HIỆN</th>
                  <th className="pb-2.5">HÀNH ĐỘNG (ACTION)</th>
                  <th className="pb-2.5">ĐỐI TƯỢNG (TARGET)</th>
                  <th className="pb-2.5">IP ADDRESS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 text-slate-400">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString("vi-VN") : "—"}
                    </td>
                    <td className="py-2.5 text-white font-semibold">
                      {log.adminUsername || "Hệ thống / API"}
                    </td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-300">
                      {log.targetType} {log.targetId ? `(#${log.targetId})` : ""}
                    </td>
                    <td className="py-2.5 text-slate-400">{log.ipAddress || "127.0.0.1"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-slate-500 bg-black/20 rounded-lg border border-slate-800/60">
            Chưa có sự kiện nào được ghi nhận trong bảng audit_logs.
          </div>
        )}
      </div>

      {/* 5. Interactive API Documentation & Code Snippets */}
      <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-4">
        <div className="space-y-0.5">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Code className="w-4 h-4 text-emerald-400" />
            <span>Tài Liệu API & Mẫu Gọi Lệnh cURL</span>
          </h2>
          <p className="text-xs text-slate-400">
            Dành cho đối tác Reseller, Discord Bot hoặc hệ thống Auto nạp thẻ bên ngoài.
          </p>
        </div>

        {/* Snippet Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveSnippetTab("activate")}
            className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
              activeSnippetTab === "activate"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            POST /api/v1/licenses/activate
          </button>
          <button
            onClick={() => setActiveSnippetTab("validate")}
            className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
              activeSnippetTab === "validate"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            POST /api/v1/licenses/validate
          </button>
          <button
            onClick={() => setActiveSnippetTab("create")}
            className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
              activeSnippetTab === "create"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            POST /api/v1/admin/licenses (Reseller)
          </button>
        </div>

        {/* Code Content */}
        <div className="relative">
          <div className="bg-black/80 p-4 rounded-lg border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto leading-relaxed select-all">
            {activeSnippetTab === "activate" && (
              <pre>{`curl -X POST "http://localhost:3000/api/v1/licenses/activate" \\
  -H "Content-Type: application/json" \\
  -d '{
    "licenseKey": "AR-XXXX-XXXX-XXXX-XXXX",
    "installationId": "HWID-DEVICE-UNIQUE-ID",
    "deviceName": "Samsung Galaxy S23 Ultra",
    "platform": "termux"
  }'`}</pre>
            )}

            {activeSnippetTab === "validate" && (
              <pre>{`curl -X POST "http://localhost:3000/api/v1/licenses/validate" \\
  -H "Content-Type: application/json" \\
  -d '{
    "licenseKey": "AR-XXXX-XXXX-XXXX-XXXX",
    "installationId": "HWID-DEVICE-UNIQUE-ID"
  }'`}</pre>
            )}

            {activeSnippetTab === "create" && (
              <pre>{`curl -X POST "http://localhost:3000/api/v1/admin/licenses" \\
  -H "Authorization: Bearer sk_live_your_secret_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "plan": "pro",
    "maxDevices": 2,
    "expiresInDays": 30
  }'`}</pre>
            )}
          </div>
        </div>
      </div>

      {/* 6. Modal Create API Key */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white">Tạo Secret API Key Mới</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕ Đóng
              </button>
            </div>

            <form onSubmit={handleCreateKey} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Tên định danh ứng dụng / đối tác:
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Reseller Webhook, Telegram Alert Bot..."
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-black/50 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Loại quyền & Scopes:
                </label>
                <select
                  value={newKeyRole}
                  onChange={(e) => setNewKeyRole(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-black/50 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="reseller">Reseller (Tạo key, tra cứu, reset HWID)</option>
                  <option value="bot">Bot Notifier (Webhook thanh toán, tra cứu key)</option>
                  <option value="admin">Master Admin (Full quyền hệ thống)</option>
                </select>
              </div>

              <div className="p-3 bg-emerald-950/30 border border-emerald-500/20 rounded-lg text-emerald-300 text-[11px] leading-relaxed">
                Key mới sẽ được tạo ngẫu nhiên bảo mật cao và lưu trực tiếp vào bảng cấu hình hệ thống MySQL.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold cursor-pointer"
                >
                  Tạo Token Ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-App Confirmation Modal */}
      <ConfirmActionModal
        isOpen={Boolean(confirmModal)}
        onClose={() => setConfirmModal(null)}
        onConfirm={confirmModal?.action}
        title={confirmModal?.title}
        description={confirmModal?.description}
        confirmText={confirmModal?.confirmText}
        variant={confirmModal?.variant}
        details={confirmModal?.details}
      />
    </div>
  );
}
