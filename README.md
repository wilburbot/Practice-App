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
- All metrics (kills, efficiency %, points, etc.) are computed on the fly from these raw events — see
  `server/src/lib/metrics.ts`

## Notes & next steps

- Auth is a simple email/password + JWT, intended for one coaching staff. The JWT is stored in the browser's
  `localStorage`; if you ever expose this beyond a small trusted staff, consider moving to httpOnly cookies.
- Only one coach account owns a team right now. Multi-coach access to the same team is a natural next step if
  you want assistant coaches tracking stats too.
- Weekly reports currently render in the app; adding email/PDF export is a good follow-up if you want to send
  them to players or parents automatically.
