import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "@/features/auth/token-store";

const baseURL = import.meta.env.VITE_API_URL ?? "/api";

export const api = axios.create({ baseURL });

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  try {
    const res = await axios.post(`${baseURL}/auth/token/refresh/`, { refresh });
    const { access, refresh: newRefresh } = res.data;
    setTokens(access, newRefresh ?? refresh);
    return access;
  } catch {
    clearTokens();
    return null;
  }
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean };
    if (error.response?.status === 401 && original && !original._retried) {
      original._retried = true;
      refreshing ??= refreshAccessToken().finally(() => {
        refreshing = null;
      });
      const token = await refreshing;
      if (token) {
        original.headers.set("Authorization", `Bearer ${token}`);
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);
