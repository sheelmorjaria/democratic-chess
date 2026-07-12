"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { login, register } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (mode === "register") await register(username, email, password);
      else await login(email, password);
      router.push("/lobby");
    } catch (e) {
      setError(e instanceof Error ? e.message : "auth failed");
    }
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 360, fontFamily: "system-ui, sans-serif" }}>
      <h1>{mode === "login" ? "Log in" : "Register"}</h1>
      <form onSubmit={submit} style={{ display: "grid", gap: "0.5rem" }}>
        {mode === "register" && (
          <input placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        )}
        <input type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit">{mode === "login" ? "Log in" : "Create account"}</button>
      </form>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <p>
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          style={{ background: "none", border: "none", color: "blue", cursor: "pointer" }}
        >
          {mode === "login" ? "Need an account? Register" : "Have an account? Log in"}
        </button>
      </p>
    </main>
  );
}
