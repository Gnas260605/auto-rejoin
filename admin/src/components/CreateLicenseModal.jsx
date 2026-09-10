import React, { useState } from "react";
import { X, Key, Copy, Check, AlertTriangle, ShieldCheck } from "lucide-react";
import { api } from "../api/client.js";

export function CreateLicenseModal({ isOpen, onClose, onCreated, plans = [] }) {
  const [plan, setPlan] = useState("pro");
  const [maxDevices, setMaxDevices] = useState(1);
  const [expiryOption, setExpiryOption] = useState("30");
  const [customDays, setCustomDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Key generated state
  const [createdKey, setCreatedKey] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      let expiresInDays = null;
      if (expiryOption !== "lifetime") {
        expiresInDays = expiryOption === "custom" ? Number(customDays) : Number(expiryOption);
      }

      const res = await api.createLicense({
        plan,
        maxDevices: Number(maxDevices),
        expiresInDays
      });

      if (res.ok && res.licenseKey) {
        setCreatedKey(res.licenseKey);
        if (onCreated) {
          onCreated(res.license);
        }
      } else {
        throw new Error(res.message || "Failed to create license");
      }
    } catch (err) {
      setError(err.message || "Failed to create license");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleClose = () => {
    setCreatedKey(null);
    setCopied(false);
    setError("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {!createdKey ? (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-100">Create New License</h3>
                <p className="text-sm text-slate-400">Generate a cryptographically secured license key</p>
              </div>
            </div>

            {error && (
              <div className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">License Plan</label>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 capitalize"
                >
                  {plans.length > 0 ? (
                    plans.map((p) => (
                      <option key={p.plan} value={p.plan}>
                        {p.plan.toUpperCase()} — {p.maxInstances} instances ({p.features.join(", ")})
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="basic">Basic (1 instance)</option>
                      <option value="standard">Standard (5 instances)</option>
                      <option value="pro">Pro (20 instances)</option>
                      <option value="business">Business (100 instances)</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Max Devices (Concurrent Slots)</label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={maxDevices}
                  onChange={(e) => setMaxDevices(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                  required
                />
                <p className="mt-1 text-xs text-slate-400">Number of unique Android devices allowed to activate this license</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">License Expiration</label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: "30", label: "30 Days" },
                    { id: "90", label: "90 Days" },
                    { id: "365", label: "1 Year" },
                    { id: "7", label: "7 Days" },
                    { id: "lifetime", label: "Lifetime" },
                    { id: "custom", label: "Custom" }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setExpiryOption(opt.id)}
                      className={`py-2 px-3 text-sm font-medium rounded-xl border transition-all ${
                        expiryOption === opt.id
                          ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                          : "bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {expiryOption === "custom" && (
                  <div className="mt-3">
                    <input
                      type="number"
                      min="1"
                      max="3650"
                      placeholder="Number of days"
                      value={customDays}
                      onChange={(e) => setCustomDays(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                      required
                    />
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                >
                  {loading ? "Generating Key..." : "Generate License"}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-100">License Generated!</h3>
                <p className="text-sm text-slate-400">Copy and provide this key to the customer</p>
              </div>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Raw License Key
              </span>
              <div className="flex items-center justify-between gap-3 p-3 bg-slate-900 border border-emerald-500/30 rounded-xl">
                <code className="font-mono text-base font-bold text-emerald-400 tracking-wider break-all">
                  {createdKey}
                </code>
                <button
                  onClick={handleCopy}
                  className="px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied!" : "Copy Key"}
                </button>
              </div>
            </div>

            <div className="mt-5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <p className="font-bold text-amber-200 uppercase tracking-wide">⚠ SAVE THIS KEY NOW</p>
                <p className="mt-1 text-amber-300/90 leading-relaxed">
                  The server stores only a secure HMAC-SHA256 hash. The plaintext key cannot be retrieved or viewed again once this dialog is closed.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="w-full sm:w-auto px-6 py-2.5 text-sm font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-colors shadow-lg shadow-emerald-500/20"
              >
                I have saved this key — Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
