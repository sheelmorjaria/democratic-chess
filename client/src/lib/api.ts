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
  const text = await res.text();
  return text ? JSON.parse(text) : undefined;
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

export function addTeamMember(teamId: string, userId: string): Promise<void> {
  return request(`/teams/${teamId}/members`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  }) as Promise<void>;
}

export function removeTeamMember(teamId: string, userId: string): Promise<void> {
  return request(`/teams/${teamId}/members/${userId}`, { method: "DELETE" }) as Promise<void>;
}

export interface UserLookup {
  id: string;
  username: string;
}

/** Resolve a username to a user id (for inviting by name). 404 if not found. */
export function findUserByUsername(username: string): Promise<UserLookup> {
  return request(`/users/lookup?username=${encodeURIComponent(username)}`) as Promise<UserLookup>;
}

export interface TeamMember {
  userId: string;
  role: "CAPTAIN" | "MEMBER";
  user: { id: string; username: string };
}

export interface TeamDetail {
  id: string;
  name: string;
  captainId: string;
  members: TeamMember[];
}

export function getTeam(teamId: string): Promise<TeamDetail> {
  return request(`/teams/${teamId}`) as Promise<TeamDetail>;
}

// ---- team invites (email-based) ----

export interface MyTeam {
  id: string;
  name: string;
  captainId: string;
  role: "CAPTAIN" | "MEMBER";
}

/** Teams the caller belongs to (drives the roster selector). */
export function listMyTeams(): Promise<MyTeam[]> {
  return request("/teams/mine") as Promise<MyTeam[]>;
}

export interface InviteResult {
  status: "added" | "already_member" | "invited";
  email: string;
  username?: string;
  inviteUrl?: string;
}

/** Invite by email: adds a registered user immediately, else creates a pending invite + link. */
export function inviteMember(teamId: string, email: string): Promise<InviteResult> {
  return request(`/teams/${teamId}/invites`, {
    method: "POST",
    body: JSON.stringify({ email }),
  }) as Promise<InviteResult>;
}

export interface TeamInviteView {
  id: string;
  email: string;
  status: "PENDING" | "ACCEPTED" | "CANCELLED";
  createdAt: string;
  inviteUrl?: string;
}

export function listTeamInvites(teamId: string): Promise<{ invites: TeamInviteView[] }> {
  return request(`/teams/${teamId}/invites`) as Promise<{ invites: TeamInviteView[] }>;
}

export function cancelTeamInvite(teamId: string, inviteId: string): Promise<void> {
  return request(`/teams/${teamId}/invites/${inviteId}`, { method: "DELETE" }) as Promise<void>;
}

/** Accept a shareable invite link (logged in; email must match). */
export function acceptInvite(token: string): Promise<{ status: string; teamId: string }> {
  return request(`/teams/invites/${token}/accept`, { method: "POST" }) as Promise<{
    status: string;
    teamId: string;
  }>;
}

// ---- WebRTC team voice (P2P mesh) ----

export function getIceServers(): Promise<{ iceServers: RTCIceServer[] }> {
  return request("/webrtc/ice") as Promise<{ iceServers: RTCIceServer[] }>;
}

export interface MatchSummary {
  id: string;
  mode: "TEAM_VS_TEAM" | "SOLO_VS_TEAM";
  status: "WAITING" | "ACTIVE" | "COMPLETED" | "ABORTED";
  winner: "WHITE" | "BLACK" | "DRAW" | null;
  fen: string;
  turn: "WHITE" | "BLACK";
  moveWindowSec: number;
}

/** Authoritative match state — the resync source of truth on reconnect. */
export function getMatch(matchId: string): Promise<MatchSummary> {
  return request(`/matches/${matchId}`) as Promise<MatchSummary>;
}

export interface LeaderboardEntry {
  subjectId: string;
  name: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
}

export function getLeaderboard(type: "TEAM" | "SOLO" = "TEAM"): Promise<{ entries: LeaderboardEntry[] }> {
  return request(`/leaderboard?type=${type}`) as Promise<{ entries: LeaderboardEntry[] }>;
}

export interface QueueJoinResult {
  queued: boolean;
  searchBand?: number;
  matchId?: string;
  mode?: string;
}

export function joinQueueSolo(): Promise<QueueJoinResult> {
  return request("/queue/join", {
    method: "POST",
    body: JSON.stringify({ subjectType: "SOLO" }),
  }) as Promise<QueueJoinResult>;
}

export function joinQueueTeam(teamId: string): Promise<QueueJoinResult> {
  return request("/queue/join", {
    method: "POST",
    body: JSON.stringify({ subjectType: "TEAM", subjectId: teamId }),
  }) as Promise<QueueJoinResult>;
}

export function leaveQueue(): Promise<void> {
  return request("/queue/leave", { method: "DELETE" }) as Promise<void>;
}

export interface QueueStatus {
  state: "idle" | "queued" | "matched";
  estimatedWaitSec: number | null;
  matchId?: string;
  mode?: string;
}

export function getQueueStatus(): Promise<QueueStatus> {
  return request("/queue/status") as Promise<QueueStatus>;
}
