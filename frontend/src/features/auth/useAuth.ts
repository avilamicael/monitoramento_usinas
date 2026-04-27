import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { clearTokens, getAccessToken, setTokens } from "./token-store";

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  papel: "administrador" | "operacional";
  empresa: { id: string; nome: string } | null;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get<AuthUser>("/usuarios/me/");
      setUser(res.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await api.post("/auth/token/", { username, password });
      setTokens(res.data.access, res.data.refresh);
      await load();
    },
    [load],
  );

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  // Compat com hooks copiados do antigo (firmasolar) que usam
  // `isAuthenticated`, `isLoading`, `user.name`.
  const isAuthenticated = !!user;
  const isLoading = loading;
  const userCompat = user
    ? {
        ...user,
        name: [user.username, user.email].filter(Boolean)[0] ?? "",
      }
    : null;

  return {
    user: userCompat,
    loading,
    isAuthenticated,
    isLoading,
    login,
    logout,
  };
}
