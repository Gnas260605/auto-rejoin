const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1/admin";

export class ApiError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

let onUnauthorizedCallback = null;

export function setOnUnauthorized(callback) {
  onUnauthorizedCallback = callback;
}

export async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const token = sessionStorage.getItem("admin_token");
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const config = {
    method: options.method || "GET",
    headers,
    credentials: "include",
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  };

  try {
    const res = await fetch(url, config);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 401) {
        sessionStorage.removeItem("admin_token");
        if (onUnauthorizedCallback) {
          onUnauthorizedCallback();
        }
      }
      const code = data.code || (res.status === 429 ? "RATE_LIMITED" : "API_ERROR");
      const message = data.message || `Request failed with status ${res.status}`;
      throw new ApiError(code, message, res.status);
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError("NETWORK_ERROR", error.message || "Failed to communicate with server", 0);
  }
}

export const api = {
  // Auth
  login: async (credentials) => {
    const res = await request("/auth/login", { method: "POST", body: credentials });
    if (res.token) {
      sessionStorage.setItem("admin_token", res.token);
    }
    return res;
  },
  logout: async () => {
    try {
      await request("/auth/logout", { method: "POST" });
    } finally {
      sessionStorage.removeItem("admin_token");
    }
  },
  getMe: () => request("/auth/me"),

  // Meta & Stats & Pricing
  getPlans: () => request("/meta/plans"),
  getPricing: () => request("/pricing"),
  updatePricing: (plans) => request("/pricing", { method: "PUT", body: { plans } }),
  getStats: () => request("/stats"),
  getPublicPricing: async () => {
    try {
      const res = await fetch("/api/v1/meta/public-pricing");
      const data = await res.json();
      return data.plans || [];
    } catch (_e) {
      return [];
    }
  },

  // Licenses
  listLicenses: (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set("page", params.page);
    if (params.limit) query.set("limit", params.limit);
    if (params.search) query.set("search", params.search);
    if (params.status) query.set("status", params.status);
    if (params.plan) query.set("plan", params.plan);
    if (params.expiringSoon) query.set("expiringSoon", "1");
    const qs = query.toString() ? `?${query.toString()}` : "";
    return request(`/licenses${qs}`);
  },
  createLicense: (data) => request("/licenses", { method: "POST", body: data }),
  createDirectSaleLicense: (data) => request("/licenses/direct-issue", { method: "POST", body: data }),
  getHandoverTemplate: (id) => request(`/licenses/${id}/handover`),
  batchCreateLicenses: (data) => request("/licenses/batch", { method: "POST", body: data }),
  getLicense: (id) => request(`/licenses/${id}`),
  updateLicense: (id, data) => request(`/licenses/${id}`, { method: "PATCH", body: data }),
  extendLicense: (id, days) => request(`/licenses/${id}/extend`, { method: "POST", body: { days } }),
  suspendLicense: (id) => request(`/licenses/${id}/suspend`, { method: "POST" }),
  reactivateLicense: (id) => request(`/licenses/${id}/reactivate`, { method: "POST" }),
  revokeLicense: (id) => request(`/licenses/${id}/revoke`, { method: "POST" }),

  // Payments (Customer & Webhook Flow & PayOS)
  createPaymentOrder: async (planId, userId = null) => {
    const res = await fetch("/api/v1/payments/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, userId })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(data.code || "PAYMENT_CREATE_ERROR", data.message || "Failed to create payment order", res.status);
    }
    return data;
  },
  getPaymentStatus: async (paymentCode) => {
    const res = await fetch(`/api/v1/payments/${encodeURIComponent(paymentCode)}/status`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(data.code || "PAYMENT_STATUS_ERROR", data.message || "Failed to get payment status", res.status);
    }
    return data;
  },
  cancelPaymentOrder: async (paymentCode, reason = "user_cancelled") => {
    const res = await fetch(`/api/v1/payments/${encodeURIComponent(paymentCode)}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(data.code || "PAYMENT_CANCEL_ERROR", data.message || "Failed to cancel payment order", res.status);
    }
    return data;
  },
  listAdminPayments: (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set("page", params.page);
    if (params.limit) query.set("limit", params.limit);
    if (params.status) query.set("status", params.status);
    if (params.search) query.set("search", params.search);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return request(`/payments${qs}`);
  },
  manualVerifyPayment: (paymentIdOrCode) =>
    request(`/payments/${paymentIdOrCode}/verify`, { method: "POST" }),
  cancelAdminPayment: (paymentCode) =>
    request(`/payments/${paymentCode}/cancel`, { method: "POST" }),
  deletePayment: (id) =>
    request(`/payments/${id}`, { method: "DELETE" }),
  cleanupIncompletePayments: () =>
    request("/payments/cleanup-incomplete", { method: "POST" }),
  getRevenueStats: () => request("/payments/revenue-stats"),

  // PayOS Gateway API
  getPayOSConfig: () => request("/payos/config"),
  savePayOSConfig: (data) => request("/payos/config", { method: "PUT", body: data }),
  testPayOS: (data) => request("/payos/test", { method: "POST", body: data }),

  // Public Customer APIs
  createCustomerOrder: async (orderData) => {
    const res = await fetch("/api/v1/licenses/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderData)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(data.code || "ORDER_ERROR", data.message || "Failed to create order", res.status);
    }
    return data;
  },
  lookupLicense: async (licenseKey) => {
    const res = await fetch("/api/v1/licenses/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(data.code || "LOOKUP_ERROR", data.message || "Failed to lookup license", res.status);
    }
    return data;
  },
  customerResetDevice: async (licenseKey, deviceId) => {
    const res = await fetch("/api/v1/licenses/customer-reset-device", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey, deviceId })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(data.code || "RESET_ERROR", data.message || "Failed to reset device", res.status);
    }
    return data;
  },

  // Devices
  listDevices: (licenseId, params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set("page", params.page);
    if (params.limit) query.set("limit", params.limit);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return request(`/licenses/${licenseId}/devices${qs}`);
  },
  revokeDevice: (licenseId, deviceId) =>
    request(`/licenses/${licenseId}/devices/${deviceId}/revoke`, { method: "POST" }),

  // Events & Audit
  listEvents: (licenseId, params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set("page", params.page);
    if (params.limit) query.set("limit", params.limit);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return request(`/licenses/${licenseId}/events${qs}`);
  },
  listAuditLogs: (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set("page", params.page);
    if (params.limit) query.set("limit", params.limit);
    if (params.action) query.set("action", params.action);
    if (params.targetType) query.set("targetType", params.targetType);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return request(`/audit-logs${qs}`);
  },

  // Generic Settings (API Keys, Marketing, SEO)
  getSetting: (key) => request(`/settings/${key}`),
  setSetting: (key, data) => request(`/settings/${key}`, { method: "PUT", body: data })
};
