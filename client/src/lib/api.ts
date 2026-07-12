const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function authHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeader(), ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `request failed: ${res.status}`);
  }
  return res.json();
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; username: string; email: string };
}

export function register(username: string, email: string, password: string): Promise<AuthResponse> {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  }) as Promise<AuthResponse>;
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  }) as Promise<AuthResponse>;
}

export function createTeam(name: string): Promise<{ id: string; name: string }> {
  return request("/teams", { method: "POST", body: JSON.stringify({ name }) }) as Promise<{
    id: string;
    name: string;
  }>;
}

export function createMatch(whiteTeamId: string, blackTeamId: string): Promise<{ id: string }> {
  return request("/matches", {
    method: "POST",
    body: JSON.stringify({ whiteTeamId, blackTeamId }),
  }) as Promise<{ id: string }>;
}
