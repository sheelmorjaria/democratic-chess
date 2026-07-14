"use client";

import { useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";
import { getIceServers } from "@/lib/api";
import { VoiceMesh, type VoicePeer } from "@/lib/webrtc";
import { Button } from "./ui/Button";
import { Banner } from "./ui/Banner";

interface CallBarProps {
  matchId: string;
  color: "white" | "black";
}

/**
 * P2P team-voice control. Owns one VoiceMesh (browser-to-browser audio mesh);
 * the server only relays signaling. Hidden for solo matches (no team).
 */
export default function CallBar({ matchId, color }: CallBarProps) {
  const meshRef = useRef<VoiceMesh | null>(null);
  const [inCall, setInCall] = useState(false);
  const [muted, setMuted] = useState(false);
  const [peers, setPeers] = useState<VoicePeer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");

  const me =
    typeof window !== "undefined"
      ? (JSON.parse(localStorage.getItem("user") || "null") as { id: string; username: string } | null)
      : null;

  useEffect(() => {
    void navigator.mediaDevices
      ?.enumerateDevices()
      .then((d) => setDevices(d.filter((x) => x.kind === "audioinput")))
      .catch(() => {});
    return () => {
      meshRef.current?.leave();
      meshRef.current = null;
    };
  }, []);

  async function join() {
    setError(null);
    if (!me) {
      setError("not signed in");
      return;
    }
    try {
      const socket = getSocket();
      if (!socket) {
        setError("not connected");
        return;
      }
      const { iceServers } = await getIceServers();
      const mesh = new VoiceMesh(socket, me.id, iceServers, setPeers, setError);
      meshRef.current = mesh;
      await mesh.start(deviceId || undefined);
      setInCall(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "couldn't access microphone");
    }
  }

  function leave() {
    meshRef.current?.leave();
    meshRef.current = null;
    setInCall(false);
    setPeers([]);
    setMuted(false);
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    meshRef.current?.setMuted(next);
  }

  const others = peers.filter((p) => p.userId !== me?.id).length;

  return (
    <div
      className="dc-card"
      style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
    >
      <span style={{ fontWeight: 600, fontSize: 14 }}>🔊 Team voice · {color}</span>
      {error && <Banner tone="error">{error}</Banner>}
      {inCall ? (
        <>
          <Button variant="secondary" size="sm" onClick={toggleMute}>
            {muted ? "🔇 Unmute" : "🎤 Mute"}
          </Button>
          <span className="dc-muted" style={{ fontSize: 13 }}>
            {others} other{others === 1 ? "" : "s"} connected
          </span>
          <Button variant="ghost" size="sm" onClick={leave}>
            Leave call
          </Button>
        </>
      ) : (
        <>
          <select
            className="dc-input"
            style={{ width: "auto", padding: "6px 8px" }}
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            aria-label="Microphone"
          >
            <option value="">Default microphone</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || "microphone"}
              </option>
            ))}
          </select>
          <Button variant="primary" size="sm" onClick={join}>
            Join call
          </Button>
        </>
      )}
    </div>
  );
}
