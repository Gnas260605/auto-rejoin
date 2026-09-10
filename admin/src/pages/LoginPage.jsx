import React, { useState } from "react";
import { Terminal, Lock, User, AlertTriangle, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(username, password);
    } catch (err) {
      if (err.code === "RATE_LIMITED") {
        setError("Too many login attempts. Please wait 15 minutes before trying again.");
      } else if (err.code === "ADMIN_DISABLED") {
        setError("This administrator account has been disabled.");
      } else {
        setError("Invalid username or password.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.15),rgba(255,255,255,0))]">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl animate-fadeIn">
        <div className="text-center mb-8">
          <div className="inline-flex p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl mb-4 shadow-lg shadow-emerald-500/10">
            <Terminal className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-100 tracking-tight">Auto Rejoin Pro</h2>
          <p className="mt-1 text-sm text-slate-400">License Authority Admin Console</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Admin Username
            </label>
            <div className="relative">
              <User className="w-5 h-5 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                className="w-full pl-11 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                className="w-full pl-11 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            {loading ? (
              "Authenticating..."
            ) : (
              <>
                <span>Sign In to Console</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-800/80 text-center">
          <p className="text-xs text-slate-500">
            Protected endpoint &bull; Cryptographically audited &bull; Strict rate limits
          </p>
        </div>
      </div>
    </div>
  );
}
