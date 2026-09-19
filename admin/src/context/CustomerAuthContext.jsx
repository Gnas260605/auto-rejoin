import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { customerApi, setOnCustomerUnauthorized, getCustomerToken } from "../api/customerClient.js";

const CustomerAuthContext = createContext(null);

export function CustomerAuthProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshWallet = useCallback(async () => {
    try {
      const res = await customerApi.getWallet();
      if (res.ok && res.wallet) {
        setWallet(res.wallet);
      }
    } catch (_err) {
      // ignore
    }
  }, []);

  const checkAuth = useCallback(async () => {
    const token = getCustomerToken();
    if (!token) {
      setCustomer(null);
      setWallet(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await customerApi.getMe();
      if (res.ok && res.user) {
        setCustomer(res.user);
        if (res.wallet) {
          setWallet(res.wallet);
        } else {
          await refreshWallet();
        }
      } else {
        setCustomer(null);
        setWallet(null);
      }
    } catch (_error) {
      setCustomer(null);
      setWallet(null);
    } finally {
      setLoading(false);
    }
  }, [refreshWallet]);

  useEffect(() => {
    checkAuth();
    setOnCustomerUnauthorized(() => {
      setCustomer(null);
      setWallet(null);
    });
  }, [checkAuth]);

  const login = async ({ login: loginIdentifier, password }) => {
    const res = await customerApi.login({ login: loginIdentifier, password });
    if (res.ok && res.user) {
      setCustomer(res.user);
      if (res.wallet) {
        setWallet(res.wallet);
      } else {
        refreshWallet();
      }
    }
    return res;
  };

  const register = async ({ email, username, password, fullName }) => {
    const res = await customerApi.register({ email, username, password, fullName });
    if (res.ok && res.user) {
      setCustomer(res.user);
      if (res.wallet) {
        setWallet(res.wallet);
      } else {
        refreshWallet();
      }
    }
    return res;
  };

  const logout = async () => {
    try {
      await customerApi.logout();
    } finally {
      setCustomer(null);
      setWallet(null);
    }
  };

  return (
    <CustomerAuthContext.Provider
      value={{
        customer,
        wallet,
        loading,
        login,
        register,
        logout,
        refreshWallet,
        checkAuth
      }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) {
    throw new Error("useCustomerAuth must be used within a CustomerAuthProvider");
  }
  return ctx;
}
