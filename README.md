# 🏐 VB Coach — Live Volleyball Stat Tracking & Progress Reports

A live, courtside stat-tracking app for volleyball coaches — built to replace BallTime with something that
also records video, syncs to the cloud across devices, and turns raw taps into weekly reports and individual
progress charts.

Runs as an **installable PWA** on an iPad: open it once in Safari, tap **Share → Add to Home Screen**, and it
launches full-screen with an app icon, and keeps working offline at the gym.

## What it does

- **Live tap-to-track stats** — pick a player, tap an action (Kill, Ace, Dig, Block, Assist, errors, etc.) and
  it's logged instantly, just like BallTime.
- **Optional video recording** — record the practice/match from the iPad camera; every stat tap is timestamped
  against the recording, so you can jump straight to the play later ("Kill @ 12:34").
- **Team & individual metrics** — kills, attack efficiency, digs, blocks, assists, aces, errors, points — computed
  automatically from the taps, per player and per session.
- **Weekly team reports** — auto-generated week-by-week team totals and top performers.
- **Player progress charts** — each player has a page showing their stats trending week over week, so they can
  see their own progression over the season.
- **Cloud-synced** — data lives in a real Postgres database behind an API, so it's available from any device you
  log into, not just the one iPad.
- **AI recap, Q&A, and coaching insights** (optional, needs an Anthropic API key) — a short written recap of any
  session, a chat box to ask questions about your season stats in plain English, and AI-suggested coaching
  priorities based on skill trends.

## Tech stack

- **`/server`** — Node.js + Express + TypeScript API, Prisma ORM, PostgreSQL, JWT auth, video files served from
  disk (swap in S3/Cloudflare R2 later if you outgrow local disk).
- **`/web`** — React + TypeScript + Vite, Tailwind CSS, React Router, TanStack Query, Recharts, packaged as an
  installable PWA via `vite-plugin-pwa`.

## Local development

### 1. Database

```bash
docker compose up -d          # starts Postgres on localhost:5432
```

### 2. API server

```bash
cd server
cp .env.example .env          # edit JWT_SECRET to a real random value: openssl rand -hex 32
npm install
npx prisma migrate dev --name init   # creates the schema in Postgres
npm run dev                   # http://localhost:4000
```

### 3. Web app

```bash
cd web
cp .env.example .env          # VITE_API_URL should point at the API above
npm install
npm run dev                   # http://localhost:5173
```

Open `http://localhost:5173`, create a coach account, create your team, add your roster, and start a session.

## Using it on the iPad at practice

1. Deploy the API and web app (see below) so they're reachable from the iPad over Wi-Fi/cellular.
2. On the iPad, open the web app's URL in **Safari**.
3. Tap the **Share** icon → **Add to Home Screen**.
4. Launch it from the home screen icon — it opens full-screen like a native app.
5. On first use of the camera, allow camera/microphone access when prompted.

## Deploying

This is a standard two-service web app — deploy it wherever you're comfortable:

- **API + Postgres**: Render, Railway, or Fly.io all offer a managed Postgres add-on plus a Node web service
  in a few clicks. Set `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` (your web app's URL) as environment
  variables, and run `npm run build && npm run start` (the build step also runs `prisma migrate deploy` — or
  run it once manually).
- **Web app**: Vercel, Netlify, or Cloudflare Pages — set `VITE_API_URL` to your deployed API's URL and run
  `npm run build`, publishing the `dist/` folder.
- Alternatively, self-host both together on one small VM with the included `docker-compose.yml` as a starting
  point for Postgres, and a process manager (pm2/systemd) for the two Node processes.

Video files are stored on the API server's local disk under `server/uploads/`. On most hosts this disk is
ephemeral, so if you're deploying long-term, mount a persistent volume there — or swap the upload handler in
`server/src/routes/sessions.ts` for an S3-compatible bucket once you need it.

## Data model

- **Team** → **Player**s and **Session**s (practices, matches, scrimmages)
- Each **Session** can have one attached video recording
- Each **StatEvent** ties a player + session to an `actionType` (Attack/Serve/Reception/Dig/Block/Set) and a
  `result` (Success/Error/Attempt), plus an optional timestamp into the session's video
- Reception events also carry a `passRating` (0-3, BallTime-style passer grading: 0 = ace against, 3 = perfect
  pass) and, on matches, a `servingTeam` (Own/Opponent) the coach toggles live so point-scoring % and side-out %
  can be computed, plus a `setNumber` for per-set box scores
- Attack/serve events can optionally carry a `targetX`/`targetY` (normalized 0-1 position on the opponent's
  court) tagged from the Recent Events list on Live Tracking, powering the Court Tendencies spray chart on each
  player's progress page
- `Session.videoStartedAt` is the server-authoritative clock start for whichever device currently holds the
  camera — every coach's device computes a stat tap's video timestamp from this shared value (not local device
  time), so multiple coaches tracking the same session from different iPads stay in sync with one recording
- All metrics (kills, efficiency %, passer rating, points, etc.) are computed on the fly from these raw events —
  see `server/src/lib/metrics.ts`

## Multiple coaches, one video

Only one device should actually hold the camera and record at a time — Live Tracking hides the camera controls
on any device where another coach already has a recording in progress, showing a status message instead. But
any number of coaches can be logging stats simultaneously regardless of who's recording: everyone's taps get
timestamped against that one shared recording (via `videoStartedAt`), and Live Tracking polls every few seconds
so taps from other coaches' devices show up on your screen shortly after they're logged.

## Sharing with players and parents (view-only)

From the **Team Dashboard**, click **Copy Link** under "Share With Players & Parents" to get a read-only link
(`/share/<token>`) — no account or login needed. Anyone with the link can browse the dashboard, sessions, and
video for that team, but can't edit anything (no editing routes exist behind the share token). Treat the link
like a password: anyone who has it can view, so only send it to your team. If it ever leaks, **Generate New
Link** invalidates the old one immediately.

## Adding assistant coaches (full edit access)

Only the coach who created a team (the "owner") can invite others. From the **Team Dashboard**, under "Invite an
Assistant Coach", **Copy Link** and send it (`/join/<token>`) to the other coach. When they open it:

- If they don't have an account yet, they're prompted to sign up first, then automatically resume joining.
- Once logged in, they click **Accept & Join Team** and immediately get full edit access — they can log stats,
  manage the roster, start sessions, and upload video, same as the owner.

This is what makes it possible for two coaches to track the **same live session** from two different iPads at
once: while on the Live Tracking screen, the app polls for new stat events every few seconds, so taps logged by
one coach show up on the other's screen shortly after (no manual refresh needed — this isn't full realtime
push, just short polling, so expect a few seconds of lag rather than instant sync).

The owner can see everyone with access under "Coaches" on the Team Dashboard, and remove an assistant coach's
access at any time. Only the owner can delete the team entirely or manage the invite link; assistant coaches
can do everything else.

## AI features (recap, Q&A, coaching insights)

Set `ANTHROPIC_API_KEY` on the server (get one at [console.anthropic.com](https://console.anthropic.com)) to
enable three coach-only features, powered by Claude:

- **Session recap** — a "Generate Recap" button on Session Review writes a short 3-5 sentence summary of that
  session's box score. It's cached on the session (`recapText`) so it isn't regenerated — and re-billed — every
  time you view the page; hit "Regenerate" if you want a fresh one.
- **Ask About Your Stats** — a chat box on Team Dashboard where you can ask things like "How is our serve
  receive trending?" in plain English. Each question sends a compact summary of the season's stats as context;
  it can only answer from that data, not browse the web.
- **Coaching Insights** — a button on the Skill Dashboard that suggests 3-5 concrete coaching priorities based on
  the season's skill trends (which skill needs work, what's trending well, etc.).

These call the Claude API (`claude-opus-5`) and cost real money per request — without a key set they return a
clear "not configured" error instead of crashing. They're intentionally **not** available on the read-only
player/parent share link, so a leaked share link can't run up your API bill.

## Notes & next steps

- Auth is a simple email/password + JWT, intended for one coaching staff. The JWT is stored in the browser's
  `localStorage`; if you ever expose this beyond a small trusted staff, consider moving to httpOnly cookies.
- Only one coach account owns a team right now. Multi-coach access to the same team is a natural next step if
  you want assistant coaches tracking stats too.
- Weekly reports currently render in the app; adding email/PDF export is a good follow-up if you want to send
  them to players or parents automatically.
