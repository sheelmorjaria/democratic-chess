"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as api from "./api";

interface CurrentUser {
  id: string;
  username: string;
}

interface AuthValue {
  user: CurrentUser | null;
  ready: boolean;
  register: (username: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

function persist(result: api.AuthResponse): CurrentUser {
  const user: CurrentUser = { id: result.user.id, username: result.user.username };
  localStorage.setItem("accessToken", result.accessToken);
  localStorage.setItem("refreshToken", result.refreshToken);
  localStorage.setItem("user", JSON.stringify(user));
  return user;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored) as CurrentUser);
    setReady(true);
  }, []);

  const value: AuthValue = {
    user,
    ready,
    async register(username, email, password) {
      setUser(persist(await api.register(username, email, password)));
    },
    async login(email, password) {
      setUser(persist(await api.login(email, password)));
    },
    logout() {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
