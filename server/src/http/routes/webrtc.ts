import { Router } from "express";
import { requireAuth } from "../../auth/middleware.js";

const STUN_URL = "stun:stun.l.google.com:19302";

interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/**
 * ICE servers for the P2P team-voice mesh. STUN (free) is always returned; TURN
 * (coturn) is included only when configured. Auth-gated so TURN creds aren't
 * leaked publicly. Static long-term creds for now; swap for time-limited HMAC
 * (TURN_SECRET + TTL) when hardening.
 */
export function createWebRtcRouter(): Router {
  const router = Router();

  router.get("/ice", requireAuth, (_req, res) => {
    const turnUrl = process.env.TURN_URL; // e.g. "turn:turn.example.com:3478"
    const turnUser = process.env.TURN_USER;
    const turnPass = process.env.TURN_PASS;

    const iceServers: IceServer[] = [{ urls: STUN_URL }];
    if (turnUrl && turnUser && turnPass) {
      iceServers.push({ urls: turnUrl, username: turnUser, credential: turnPass });
    }
    res.json({ iceServers });
  });

  return router;
}
