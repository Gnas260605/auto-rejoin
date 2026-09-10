import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Key,
  Smartphone,
  History,
  Shield,
  Calendar,
  Clock,
  Layers,
  Edit2,
  Pause,
  Play,
  XCircle,
  AlertTriangle,
  RotateCcw,
  CheckCircle2
} from "lucide-react";
import { api } from "../api/client.js";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { ConfirmModal } from "../components/ConfirmModal.jsx";

export function LicenseDetailPage({ licenseId, onBack }) {
  const [license, setLicense] = useState(null);
  const [devices, setDevices] = useState([]);
  const [events, setEvents] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit modal
  const [editModal, setEditModal] = useState({
    isOpen: false,
    plan: "pro",
    maxDevices: 1,
    expiresAt: ""
  });

  // Confirm modal
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    variant: "danger",
    action: null
  });

  const loadDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [licRes, devRes, evRes, plansRes] = await Promise.all([
        api.getLicense(licenseId),
        api.listDevices(licenseId),
        api.listEvents(licenseId),
        api.getPlans()
      ]);

      if (licRes.ok) setLicense(licRes.license);
      if (devRes.ok) setDevices(devRes.items || []);
      if (evRes.ok) setEvents(evRes.items || []);
      if (plansRes.ok) setPlans(plansRes.plans || []);
    } catch (err) {
      setError(err.message || "Failed to load license details");
    } finally {
      setLoading(false);
    }
  }, [licenseId]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  // Actions
  const handleEditOpen = () => {
    if (!license) return;
    setEditModal({
      isOpen: true,
      plan: license.plan,
      maxDevices: license.maxDevices,
      expiresAt: license.expiresAt ? license.expiresAt.slice(0, 10) : ""
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.updateLicense(license.id, {
        plan: editModal.plan,
        maxDevices: Number(editModal.maxDevices),
        expiresAt: editModal.expiresAt ? new Date(editModal.expiresAt).toISOString() : null
      });
      setEditModal({ ...editModal, isOpen: false });
      loadDetails();
    } catch (err) {
      alert(`Update failed: ${err.message}`);
    }
  };

  const handleSuspend = () => {
    setConfirmModal({
      isOpen: true,
      title: "Suspend License?",
      message: "Clients using this license will fail confirmation validation immediately.",
      confirmText: "Suspend",
      variant: "warning",
      action: async () => {
        await api.suspendLicense(license.id);
        loadDetails();
      }
    });
  };

  const handleReactivate = () => {
    setConfirmModal({
      isOpen: true,
      title: "Reactivate License?",
      message: "Clients will be allowed to revalidate and run bots again.",
      confirmText: "Reactivate",
      variant: "success",
      action: async () => {
        await api.reactivateLicense(license.id);
        loadDetails();
      }
    });
  };

  const handleRevokeLicense = () => {
    setConfirmModal({
      isOpen: true,
      title: "Revoke License Permanently?",
      message: "All active tokens will be revoked. This license cannot be reactivated.",
      confirmText: "Revoke Permanently",
      variant: "danger",
      action: async () => {
        await api.revokeLicense(license.id);
        loadDetails();
      }
    });
  };

  const handleRevokeDevice = (device) => {
    setConfirmModal({
      isOpen: true,
      title: "Reset Device Registration?",
      message: `Revoke device (${device.maskedInstallationId})? Active tokens for this device will be invalidated immediately, releasing 1 device slot for this license.`,
      confirmText: "Reset Device",
      variant: "danger",
      action: async () => {
        await api.revokeDevice(license.id, device.id);
        loadDetails();
      }
    });
  };

  const formatDate = (isoString) => {
    if (!isoString) return "Lifetime";
    const d = new Date(isoString);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm">Loading license details...</p>
      </div>
    );
  }

  if (error || !license) {
    return (
      <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-4">
        <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
        <p className="text-sm text-rose-400">{error || "License not found"}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl"
        >
          Return to Licenses
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-100 transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Licenses</span>
        </button>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleEditOpen}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit Plan / Slots</span>
          </button>

          {license.status === "active" ? (
            <button
              onClick={handleSuspend}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold transition-colors"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Suspend</span>
            </button>
          ) : license.status === "suspended" ? (
            <button
              onClick={handleReactivate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Reactivate</span>
            </button>
          ) : null}

          {license.status !== "revoked" && (
            <button
              onClick={handleRevokeLicense}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Revoke</span>
            </button>
          )}
        </div>
      </div>

      {/* License Overview Card */}
      <div className="p-6 sm:p-7 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              License Identifier #{license.id}
            </span>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="font-mono text-xl sm:text-2xl font-extrabold text-emerald-400 tracking-wide">
                {license.displayKey}
              </span>
              <StatusBadge status={license.status} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-xl text-sm font-bold uppercase">
              {license.plan} Plan
            </span>
          </div>
        </div>

        {/* Specs Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-slate-500 font-medium block">Device Slots</span>
            <span className="text-base font-bold text-slate-200 mt-1 block">
              {license.activeDeviceCount} / {license.maxDevices} Active
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-slate-500 font-medium block">Bot Instances</span>
            <span className="text-base font-bold text-slate-200 mt-1 block">
              {license.maxInstances} Allowed
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-slate-500 font-medium block">Expires At</span>
            <span className="text-base font-bold text-slate-200 mt-1 block">
              {formatDate(license.expiresAt)}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-slate-500 font-medium block">Created At</span>
            <span className="text-base font-bold text-slate-200 mt-1 block">
              {formatDate(license.createdAt)}
            </span>
          </div>
        </div>

        {/* Enabled Features */}
        <div className="pt-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
            Enabled Plan Entitlements
          </span>
          <div className="flex flex-wrap gap-2">
            {license.features && license.features.length > 0 ? (
              license.features.map((f) => (
                <span
                  key={f}
                  className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{f}</span>
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-500">None</span>
            )}
          </div>
        </div>
      </div>

      {/* Devices Section */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-xl">
        <div className="p-5 sm:px-7 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-base text-slate-100">Registered Devices</h3>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-xs font-semibold">
              {devices.length}
            </span>
          </div>
        </div>

        {devices.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No devices have activated with this license yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 border-b border-slate-800 uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-3 px-6 font-semibold">Installation ID</th>
                  <th className="py-3 px-6 font-semibold">Platform</th>
                  <th className="py-3 px-6 font-semibold">Executor</th>
                  <th className="py-3 px-6 font-semibold">Version</th>
                  <th className="py-3 px-6 font-semibold">First Activated</th>
                  <th className="py-3 px-6 font-semibold">Last Seen</th>
                  <th className="py-3 px-6 font-semibold">Status</th>
                  <th className="py-3 px-6 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {devices.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-6 font-mono font-bold text-slate-200">
                      {d.maskedInstallationId}
                    </td>
                    <td className="py-3.5 px-6 capitalize">{d.platform || "unknown"}</td>
                    <td className="py-3.5 px-6 font-mono text-emerald-400">{d.executor || "direct"}</td>
                    <td className="py-3.5 px-6 font-mono">{d.clientVersion || "4.0.0"}</td>
                    <td className="py-3.5 px-6 text-slate-400">{formatDate(d.firstActivatedAt)}</td>
                    <td className="py-3.5 px-6 text-slate-400">{formatDate(d.lastSeenAt)}</td>
                    <td className="py-3.5 px-6">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      {d.status === "active" && (
                        <button
                          onClick={() => handleRevokeDevice(d)}
                          className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-semibold transition-colors"
                        >
                          Reset Device
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Events / Timeline Section */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-xl">
        <div className="p-5 sm:px-7 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-base text-slate-100">License Event History</h3>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No recorded events for this license.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 border-b border-slate-800 uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-3 px-6 font-semibold">Timestamp</th>
                  <th className="py-3 px-6 font-semibold">Event</th>
                  <th className="py-3 px-6 font-semibold">Device</th>
                  <th className="py-3 px-6 font-semibold">IP Address</th>
                  <th className="py-3 px-6 font-semibold">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-6 text-slate-400">{formatDate(ev.createdAt)}</td>
                    <td className="py-3 px-6 font-semibold text-emerald-400 font-mono">
                      {ev.eventType}
                    </td>
                    <td className="py-3 px-6 font-mono text-slate-300">
                      {ev.device?.maskedInstallationId || "—"}
                    </td>
                    <td className="py-3 px-6 font-mono text-slate-500">{ev.ipAddress || "—"}</td>
                    <td className="py-3 px-6 text-slate-400 font-mono text-[11px] truncate max-w-xs">
                      {ev.metadata ? JSON.stringify(ev.metadata) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100 mb-4">Edit License Configuration</h3>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Plan</label>
                <select
                  value={editModal.plan}
                  onChange={(e) => setEditModal({ ...editModal, plan: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500/50"
                >
                  {plans.map((p) => (
                    <option key={p.plan} value={p.plan}>
                      {p.plan.toUpperCase()} ({p.maxInstances} instances)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Max Devices (Concurrent Slots)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={editModal.maxDevices}
                  onChange={(e) => setEditModal({ ...editModal, maxDevices: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500/50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Expires Date (Leave blank for Lifetime)
                </label>
                <input
                  type="date"
                  value={editModal.expiresAt}
                  onChange={(e) => setEditModal({ ...editModal, expiresAt: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditModal({ ...editModal, isOpen: false })}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-md shadow-emerald-500/20"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Action Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        variant={confirmModal.variant}
        onConfirm={async () => {
          if (confirmModal.action) {
            await confirmModal.action();
          }
          setConfirmModal({ ...confirmModal, isOpen: false });
        }}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
    </div>
  );
}
