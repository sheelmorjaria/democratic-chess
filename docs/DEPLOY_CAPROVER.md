# Deploying DemocraticChess to CapRover

This app is an npm-workspaces monorepo with **two deployable services**:

| Service | Source | CapRover app | Container port | Build file |
| --- | --- | --- | --- | --- |
| API + realtime (Express + uWebSockets.js + Prisma) | `server/` | `dc-server` | `3001` | `Dockerfile.server` |
| Web client (Next.js) | `client/` | `dc-client` | `3000` | `Dockerfile.client` |

Plus **PostgreSQL** and **Redis** (provisioned as CapRover one-click apps). The client and server are deployed as **two separate CapRover apps** built from the same repo root.

---

## 0. Files in this repo

- `captain-definition` → points to `./Dockerfile.server` (the **server** app).
- `captain-definition.client` → points to `./Dockerfile.client` (the **client** app). CapRover reads a file named exactly `captain-definition`, so when deploying the client either rename this to `captain-definition`, paste its contents into the app's "Deploy from Captain-Definition" box, or put it at the repo root on a dedicated branch (see §5).
- `Dockerfile.server`, `Dockerfile.client` — multi-stage builds; **build context = repo root**.
- `.dockerignore` — shared, keeps the context lean.

> The server image runs `prisma migrate deploy` automatically on start, so the schema is applied on first boot.

---

## 1. Provision Postgres + Redis (one-click apps)

In CapRover → **Apps → One-Click Apps**, create:

- **PostgreSQL** (e.g. internal app name `dc-db`) → note the database name, user, password. CapRover shows a **Connection URL**. The host is the internal name `srv-captain--dc-db` (reachable from other apps on the same server).
- **Redis** (e.g. internal app name `dc-redis`) → host `srv-captain--dc-redis`, port `6379`.

You'll use these values in §3.

Example connection strings (internal, same-CapRover-server):

```
DATABASE_URL=postgresql://<user>:<password>@srv-captain--dc-db:5432/<dbname>?schema=public
REDIS_URL=redis://srv-captain--dc-redis:6379
```

> Using an **external** managed Postgres/Redis instead? Just use its connection string in §3 — nothing else changes.

---

## 2. Create the two web apps

CapRover → **Apps → Create New App** (not from a one-click template):

- `dc-server` — do **not** enable "Has Persistent Data".
- `dc-client` — same.

After creating, under each app → **HTTP Settings**, set **Container Port**:

- `dc-server` → **3001**
- `dc-client` → **3000**

Then connect your domains (App → **HTTP Settings → Connect new domain**):

- `dc-server.your-root.example.com`
- `dc-client.your-root.example.com`

Enable **Force HTTPS** on both.

---

## 3. Environment variables

### `dc-server` (App → Config → Environment Variables)

| Key | Value |
| --- | --- |
| `DATABASE_URL` | from §1 (internal `srv-captain--dc-db` host) |
| `REDIS_URL` | from §1 (internal `srv-captain--dc-redis` host) |
| `JWT_SECRET` | a long random string (`openssl rand -hex 32`) |
| `CLIENT_ORIGIN` | `https://dc-client.your-root.example.com` (CORS — must match the client origin **exactly**) |
| `TURN_URL` | `turn:dc-turn.your-root.example.com:3478` (team-voice relay — see §6; omit to run STUN-only) |
| `TURN_USER` / `TURN_PASS` | static coturn credentials (must match the coturn app) |

The server reads `PORT` (defaults to `3001`, the public container port — **uWebSockets.js owns it**: it handles WS upgrades natively and forwards plain HTTP to Express on the loopback-only `INTERNAL_PORT`, default `PORT+1`, not exposed). No build-time vars needed.

### `dc-client` (runtime)

None required at runtime. **But see §4** — the API URL is baked in at *build* time.

---

## 4. ⚠️ The `NEXT_PUBLIC_API_URL` build-time gotcha

The client reads `NEXT_PUBLIC_API_URL` (REST + WebSocket base URL — the same origin serves both; the WS connects to `wss://<that origin>/?token=<jwt>`). Next.js **inlines `NEXT_PUBLIC_*` at build time**, and **CapRover does not pass app env vars into the build** ([caprover/caprover#343](https://github.com/caprover/caprover/issues/343)). So setting it in the app UI does nothing for the bundle.

`Dockerfile.client` declares it as a build `ARG` with a placeholder default:

```dockerfile
ARG NEXT_PUBLIC_API_URL=https://dc-server.CHANGE_ME.example.com
```

**Before deploying the client, edit that line** to your real server URL (it's a public value — it ends up in the browser bundle regardless), e.g.:

```dockerfile
ARG NEXT_PUBLIC_API_URL=https://dc-server.your-root.example.com
```

Then build/deploy. Alternatives:
- **CI build**: build the image in GitHub Actions with `--build-arg NEXT_PUBLIC_API_URL=...`, push to a registry, and deploy the app **from image** (Deployment → Method 1). This keeps the URL out of the Dockerfile.
- **Runtime config**: stop using `NEXT_PUBLIC_*` and fetch a `/config.json` at runtime (a code change — not done here).

> CORS pairing: `CLIENT_ORIGIN` on the server must equal the client's origin, and `NEXT_PUBLIC_API_URL` on the client must equal the server's origin. Set both to the **public HTTPS domains** before building.

---

## 5. Deploy each app

CapRover reads a single `captain-definition` from the repo root per app. Pick one:

**Option A — CapRover UI / CLI per app (simplest for two apps from one repo):**
- Deploy `dc-server`: upload the repo (or use the CapRover CLI) with the root `captain-definition` (already points to `Dockerfile.server`).
- Deploy `dc-client`: use the contents of `captain-definition.client` (rename to `captain-definition`, paste into "Deploy from Captain-Definition", or `caprover deploy` with that file as root).

**Option B — GitHub auto-deploy with branches:**
- Branch `deploy/server`: root `captain-definition` → `./Dockerfile.server`. Point `dc-server` at it.
- Branch `deploy/client`: root `captain-definition` → `./Dockerfile.client`. Point `dc-client` at it.

**Option C — prebuilt images (CI):** build both images in CI (passing the `NEXT_PUBLIC_API_URL` build-arg for the client), push to CapRover's registry or Docker Hub, and deploy each app **from image**.

On the first server start, the container runs `prisma migrate deploy` then `node server/dist/index.js` — check the app logs to confirm the migration applied and the server booted on `:3001`.

---

## 6. Notes & gotchas

- **WebSocket (uWebSockets.js)**: the realtime layer is raw WebSocket on the same origin (`wss://dc-server…/?token=<jwt>` — no `/socket.io/` path). CapRover's reverse proxy (Traefik) upgrades WS on the same HTTPS origin transparently. Single-replica by default; the Redis room-bridge (`bus.startBridge()` in `index.ts`) preserves cross-instance fan-out if you scale out (the in-process turn/forfeit timers still need a session-affinity load balancer).
- **Team voice (P2P WebRTC + coturn)**: audio flows browser-to-browser; the server only relays signaling. For users behind symmetric/carrier-grade NAT, run a coturn TURN relay — either a CapRover app exposing UDP+TCP `3478` and the relay range (`49152-49252`), or `docker compose --profile turn up coturn` on the host. Set `TURN_URL`/`TURN_USER`/`TURN_PASS` on `dc-server` to the same values the coturn app uses. STUN-only covers ~85% without it.
- **First-deploy order**: start Postgres + Redis, then `dc-server` (so migrations run), then `dc-client`.
- **Image size**: the client image currently installs the union of monorepo prod deps (includes the server's deps). It works as-is; a future optimization is Next.js `output: "standalone"` to produce a minimal runtime.
- **Changing the client API URL later** requires a rebuild (it's baked in), so flip the `ARG` and redeploy `dc-client`.
- **Secrets**: never commit real `DATABASE_URL` / `JWT_SECRET` — set them in CapRover's app env. `.gitignore` already excludes `server/.env` and `client/.env`.

---

## 7. Verify

1. `https://dc-server.your-root.example.com/health` (or any REST route) returns 200.
2. `https://dc-client.your-root.example.com` loads the lobby/login UI and the theme swatches work.
3. Log in, start a match, and confirm the board connects over socket and votes execute end-to-end.
