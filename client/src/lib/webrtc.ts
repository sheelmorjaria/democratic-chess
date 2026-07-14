"use client";

import type { DcSocket } from "./socket";

/**
 * P2P team-voice mesh manager. One RTCPeerConnection per teammate; audio flows
 * browser-to-browser. The server only relays signaling (webrtc_offer/answer/ice)
 * and broadcasts the call roster (webrtc_peers).
 *
 * Glare-free: for any pair, the peer with the lexicographically-smaller userId
 * creates the offer, so each pair has exactly one offer regardless of join order.
 */
export interface VoicePeer {
  userId: string;
  username: string;
}

interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

const MAX_PEERS = 6;

export class VoiceMesh {
  private readonly pcs = new Map<string, RTCPeerConnection>();
  private readonly remoteAudio: HTMLAudioElement[] = [];
  private localStream: MediaStream | null = null;
  private readonly handlers: Array<[string, (data: any) => void]> = [];

  constructor(
    private readonly socket: DcSocket,
    private readonly myId: string,
    private readonly iceServers: IceServer[],
    private readonly onPeers?: (peers: VoicePeer[]) => void,
    private readonly onError?: (message: string) => void,
  ) {
    this.subscribe("webrtc_peers", (d) => this.handlePeers(d?.peers ?? []));
    this.subscribe("webrtc_offer", (d) => this.handleOffer(d?.from, d?.sdp));
    this.subscribe("webrtc_answer", (d) => this.handleAnswer(d?.from, d?.sdp));
    this.subscribe("webrtc_ice", (d) => this.handleRemoteIce(d?.from, d?.candidate));
  }

  private subscribe(event: string, cb: (data: any) => void): void {
    this.socket.on(event, cb);
    this.handlers.push([event, cb]);
  }

  /** Acquire the mic and announce ourselves to the call. */
  async start(deviceId?: string): Promise<void> {
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      video: false,
    });
    this.socket.emit("webrtc_join", {});
  }

  /** Mute/unmute the local mic (track still flows, just silent). */
  setMuted(muted: boolean): void {
    for (const track of this.localStream?.getAudioTracks() ?? []) track.enabled = !muted;
  }

  private ensurePeer(peerId: string): RTCPeerConnection | null {
    if (peerId === this.myId || this.pcs.has(peerId)) return this.pcs.get(peerId) ?? null;
    if (this.pcs.size >= MAX_PEERS) return null;
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) pc.addTrack(track, this.localStream);
    }
    pc.onicecandidate = (e) => {
      if (e.candidate) this.socket.emit("webrtc_ice", { to: peerId, candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      const el = new Audio();
      el.srcObject = e.streams[0] ?? null;
      el.autoplay = true;
      void el.play().catch(() => {});
      this.remoteAudio.push(el);
    };
    this.pcs.set(peerId, pc);
    return pc;
  }

  private handlePeers(peers: VoicePeer[]): void {
    this.onPeers?.(peers);
    for (const p of peers) {
      if (p.userId === this.myId || this.pcs.has(p.userId)) continue;
      // Lower userId offers → exactly one offer per pair.
      if (this.myId < p.userId) {
        const pc = this.ensurePeer(p.userId);
        if (pc) void this.offer(pc, p.userId);
      }
    }
  }

  private async offer(pc: RTCPeerConnection, to: string): Promise<void> {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.socket.emit("webrtc_offer", { to, sdp: pc.localDescription?.toJSON() });
    } catch (e) {
      this.onError?.(String(e));
    }
  }

  private async handleOffer(from: string | undefined, sdp: unknown): Promise<void> {
    if (!from || !sdp) return;
    const pc = this.ensurePeer(from);
    if (!pc || pc.signalingState === "stable") {
      // ensurePeer may have just created it; only accept if we didn't already
      // initiate (we're the higher id → we answer).
    }
    try {
      await pc?.setRemoteDescription(new RTCSessionDescription(sdp as RTCSessionDescriptionInit));
      const answer = await pc!.createAnswer();
      await pc!.setLocalDescription(answer);
      this.socket.emit("webrtc_answer", { to: from, sdp: pc!.localDescription?.toJSON() });
    } catch (e) {
      this.onError?.(String(e));
    }
  }

  private async handleAnswer(from: string | undefined, sdp: unknown): Promise<void> {
    if (!from || !sdp) return;
    const pc = this.pcs.get(from);
    if (!pc) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp as RTCSessionDescriptionInit));
    } catch (e) {
      this.onError?.(String(e));
    }
  }

  private async handleRemoteIce(from: string | undefined, candidate: unknown): Promise<void> {
    if (!from || !candidate) return;
    const pc = this.pcs.get(from);
    if (!pc) return;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate as RTCIceCandidateInit));
    } catch {
      /* transient — ignore */
    }
  }

  /** Tell the server we left + tear down everything. */
  leave(): void {
    this.socket.emit("webrtc_leave", {});
    this.dispose();
  }

  dispose(): void {
    for (const [event, cb] of this.handlers) this.socket.off(event, cb);
    this.handlers.length = 0;
    for (const pc of this.pcs.values()) pc.close();
    this.pcs.clear();
    for (const track of this.localStream?.getTracks() ?? []) track.stop();
    this.localStream = null;
    for (const el of this.remoteAudio) {
      el.srcObject = null;
    }
    this.remoteAudio.length = 0;
  }
}
