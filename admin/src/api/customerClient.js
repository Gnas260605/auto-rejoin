export class CustomerApiError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

let onCustomerUnauthorizedCallback = null;

export function setOnCustomerUnauthorized(callback) {
  onCustomerUnauthorizedCallback = callback;
}

const ACCESS_TOKEN_KEY = "customer_access_token";
const REFRESH_TOKEN_KEY = "customer_refresh_token";

export function getCustomerToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY) || sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getCustomerRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY) || sessionStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setCustomerTokens(accessToken, refreshToken, remember = true) {
  const storage = remember ? localStorage : sessionStorage;
  if (accessToken) {
    storage.setItem(ACCESS_TOKEN_KEY, accessToken);
  }
  if (refreshToken) {
    storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearCustomerTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}

export async function requestCustomer(path, options = {}) {
  const url = `/api/v1${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const token = getCustomerToken();
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
        // Try refreshing token once if refresh token exists and this wasn't already a refresh/login request
        if (!path.startsWith("/auth/login") && !path.startsWith("/auth/refresh")) {
          const refreshToken = getCustomerRefreshToken();
          if (refreshToken) {
            try {
              const refreshRes = await fetch("/api/v1/auth/refresh", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ refreshToken })
              });
              const refreshData = await refreshRes.json();
              if (refreshRes.ok && refreshData.accessToken) {
                setCustomerTokens(refreshData.accessToken, refreshData.refreshToken);
                // Retry original request with new token
                headers.Authorization = `Bearer ${refreshData.accessToken}`;
                const retryRes = await fetch(url, { ...config, headers });
                const retryData = await retryRes.json().catch(() => ({}));
                if (retryRes.ok) {
                  return retryData;
                }
              }
            } catch (_refreshErr) {
              // Ignore and proceed to logout
            }
          }
        }

        clearCustomerTokens();
        if (onCustomerUnauthorizedCallback) {
          onCustomerUnauthorizedCallback();
        }
      }

      const code = data.code || (res.status === 429 ? "RATE_LIMITED" : "API_ERROR");
      const message = data.message || `Request failed with status ${res.status}`;
      throw new CustomerApiError(code, message, res.status);
    }

    return data;
  } catch (error) {
    if (error instanceof CustomerApiError) {
      throw error;
    }
    throw new CustomerApiError("NETWORK_ERROR", error.message || "Failed to communicate with server", 0);
  }
}

export const customerApi = {
  register: async (payload) => {
    const res = await requestCustomer("/auth/register", { method: "POST", body: payload });
    if (res.accessToken) {
      setCustomerTokens(res.accessToken, res.refreshToken);
    }
    return res;
  },

  login: async (credentials) => {
    const res = await requestCustomer("/auth/login", { method: "POST", body: credentials });
    if (res.accessToken) {
      setCustomerTokens(res.accessToken, res.refreshToken);
    }
    return res;
  },

  logout: async () => {
    try {
      const refreshToken = getCustomerRefreshToken();
      await requestCustomer("/auth/logout", {
        method: "POST",
        body: { refreshToken }
      });
    } finally {
      clearCustomerTokens();
    }
  },

  getMe: () => requestCustomer("/me"),

  getWallet: () => requestCustomer("/wallet"),

  getWalletTransactions: (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set("page", params.page);
    if (params.limit) query.set("limit", params.limit);
    if (params.type) query.set("type", params.type);
    if (params.direction) query.set("direction", params.direction);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return requestCustomer(`/wallet/transactions${qs}`);
  }
};
