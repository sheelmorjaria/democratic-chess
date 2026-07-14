"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { acceptInvite } from "@/lib/api";
import { Banner } from "@/components/ui/Banner";
import { Spinner } from "@/components/ui/Spinner";

type Phase = "working" | "done" | "error" | "need-login" | "none";

function JoinBody() {
  const params = useSearchParams();
  const token = params.get("token");
  const { user, ready } = useAuth();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("working");
  const [info, setInfo] = useState("");

  useEffect(() => {
    if (!token) {
      setPhase("none");
      return;
    }
    if (!ready) return;
    if (!user) {
      setPhase("need-login");
      return;
    }
    let cancelled = false;
    setPhase("working");
    void (async () => {
      try {
        await acceptInvite(token);
        if (!cancelled) {
          setInfo("You've joined the team.");
          setPhase("done");
        }
      } catch (e) {
        if (!cancelled) {
          setInfo(e instanceof Error ? e.message : "couldn't accept the invite");
          setPhase("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, ready, user, router]);

  const loginHref = `/login?next=${encodeURIComponent(`/join?token=${token ?? ""}`)}`;

  if (phase === "none")
    return <Banner tone="error">This invite link is invalid — it&apos;s missing a token.</Banner>;
  if (phase === "working")
    return (
      <div className="dc-row">
        <Spinner /> Accepting invite…
      </div>
    );
  if (phase === "need-login")
    return (
      <div className="dc-stack">
        <Banner tone="info">
          Log in to accept this team invite. Not registered yet? Register with the email you were
          invited to and you&apos;ll join automatically.
        </Banner>
        <div className="dc-row">
          <Link className="dc-btn dc-btn--primary" href={loginHref}>
            Log in
          </Link>
          <Link className="dc-btn dc-btn--secondary" href="/login">
            Register
          </Link>
        </div>
      </div>
    );
  if (phase === "error")
    return (
      <div className="dc-stack">
        <Banner tone="error">
          {info || "couldn't accept the invite"}. If this invite is for a different email, log in
          with that address.
        </Banner>
        <div className="dc-row">
          <Link className="dc-btn dc-btn--secondary" href={loginHref}>
            Log in
          </Link>
        </div>
      </div>
    );
  return (
    <div className="dc-stack">
      <Banner tone="success">{info}</Banner>
      <div className="dc-row">
        <Link className="dc-btn dc-btn--primary" href="/lobby">
          Go to lobby
        </Link>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <div style={{ maxWidth: 480, margin: "40px auto 0" }}>
      <Suspense
        fallback={
          <div className="dc-row">
            <Spinner />
          </div>
        }
      >
        <JoinBody />
      </Suspense>
    </div>
  );
}
