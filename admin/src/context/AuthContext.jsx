import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, setOnUnauthorized } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getMe();
      if (res.ok && res.admin) {
        setAdmin(res.admin);
      } else {
        setAdmin(null);
      }
    } catch (_error) {
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
    setOnUnauthorized(() => {
      setAdmin(null);
    });
  }, [checkAuth]);

  const login = async (username, password) => {
    const res = await api.login({ username, password });
    if (res.ok && res.admin) {
      setAdmin(res.admin);
    }
    return res;
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      setAdmin(null);
    }
  };

  return (
    <AuthContext.Provider value={{ admin, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
