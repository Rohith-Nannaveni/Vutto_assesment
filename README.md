# Torque & Gavel: used-motorcycle auction platform

A MERN marketplace where registered buyers bid on used motorcycles in live auctions and administrators manage listings and auction lifecycles. Prices update in real time over Socket.IO, and every bid is validated and arbitrated by the server.

> **Status:** built and verified locally (backend + frontend tests, production build, end-to-end smoke test). **It has not been deployed**; see [Deployment](#deployment) for exact steps. Test results and their caveats are in [Testing](#testing).

## Main features

* **Auth**: register, login, logout, protected account page. HTTP-only cookie session (8 h), CSRF header, bcrypt hashing, role-based access (`buyer`, `admin`). Admins only come from the seed script.
* **Browsing**: search (title/brand/model), filters (brand, condition, status, price range), sorting (ending soon, newest, price), pagination, detail page with gallery and specs.
* **Live bidding**: the server enforces start/end time, minimum increment, no own-listing bids, no bids on ended/cancelled auctions. Concurrent bids cannot both win. Live price, bidder count, countdown (server-clock based), outbid notifications, connection indicator.
* **My activity**: recent bids and auctions grouped as leading / outbid / won / lost / cancelled.
* **Admin**: dashboard from real counts, create/edit/cancel listings with explicit edit rules, bid audit view, server-side pagination, manual lifecycle run.
* **Operations**: structured JSON logs with request ids, `/api/health`, `/api/ready`, graceful shutdown.

## Technology

| | |
| --- | --- |
| Frontend | React 18, Vite 5, React Router 6, Tailwind CSS 3, Axios, socket.io-client, Lucide React, React Context (no Redux, no form library: forms are small enough) |
| Backend | Node 20+, Express 4, Mongoose 8, JWT (`jsonwebtoken`), `bcryptjs`, Socket.IO 4, Zod (validation), Helmet, CORS, `express-rate-limit` |
| Tests | Backend: Node's built-in test runner + Supertest + socket.io-client. Frontend: Vitest + React Testing Library |
| Database | MongoDB (Atlas in production) |

## Project layout

```
client/            React app (src/api, components, context, hooks, layouts, pages, routes, utils)
server/
  src/             config, models, middleware, validators, services, controllers, routes, sockets, utils
  scripts/seed.js  repeatable seed
  tests/           API, lifecycle, concurrency and socket tests
docs/architecture.md   diagrams, concurrency strategy, security, scaling, failure modes
render.yaml        Render blueprint (API)     client/vercel.json   Vercel config (SPA + /api rewrite)
```

## Prerequisites

Node.js 20 or newer, npm, and a MongoDB database: [MongoDB Atlas](https://www.mongodb.com/atlas) free tier, or a local `mongod`. No replica set is required (the bidding design does not use transactions).

## Installation

```bash
npm install            # root: installs the `concurrently` dev helper
npm run install:all    # installs server/ and client/ dependencies
```

## Environment configuration

```bash
cp server/.env.example server/.env     # then edit
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | yes | Connection string (include the database name). |
| `JWT_SECRET` | yes | ≥ 32 random characters. `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `CLIENT_URL` | yes | Comma-separated allowed browser origins, no trailing slash (e.g. `http://localhost:5173`). |
| `NODE_ENV` | no | `development` (default) / `production` / `test`. Production switches cookies to `Secure; SameSite=None`. |
| `PORT` | no | Default `4000`. |
| `JWT_EXPIRES_IN_HOURS` | no | Session length, default `8`. |
| `COOKIE_SAMESITE` | no | `lax`/`strict`/`none`; defaults to `lax` in dev, `none` in production. |
| `LOG_LEVEL` | no | `debug`/`info`/`warn`/`error`/`silent`. |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DEMO_USER_PASSWORD` | seed only | Credentials created by `npm run seed`. |

Client variables (`client/.env.example`) are only needed in production: `VITE_SOCKET_URL` (API origin for WebSockets) and optionally `VITE_API_URL`. In development Vite proxies `/api` and `/socket.io` to `localhost:4000`, so nothing is needed.

Never commit `.env`; it is git-ignored.

## Local development

```bash
npm run seed           # creates users, 12 motorcycles and bid history (WIPES users/auctions/bids)
npm run dev            # API on :4000 and web app on :5173
```

Open http://localhost:5173. Individually: `npm run dev:server`, `npm run dev:client`.

## Database setup and seeding

The seed script (`server/scripts/seed.js`) deletes all users, auctions and bids, then creates 1 admin, 3 buyers, and 12 listings: 6 live (one ending in a few hours), 3 upcoming, 3 ended (finalized through the real lifecycle code, one with no bids). All times are relative to "now", so re-run the seed whenever the live auctions have run out. It refuses to run with `NODE_ENV=production` unless you pass `--force`.

### Demo accounts

Credentials come from your `.env`. With the values in `server/.env.example`:

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@example.com` (`ADMIN_EMAIL`) | `ChangeMe-Admin-2026` (`ADMIN_PASSWORD`) |
| Buyers | `aarav@example.com`, `priya@example.com`, `rohan@example.com` | `DemoBuyer-2026` (`DEMO_USER_PASSWORD`) |

These are demonstration-only, contain no real personal data, and must be changed (or the database kept disposable) in any shared environment. **No hosted demo exists, so there are no live demo credentials.** Set your own `ADMIN_*` values before seeding a deployed database.

To try real-time bidding, sign in as two different buyers in two browsers, open the same live auction and bid alternately.

## Testing

```bash
npm test               # server then client
npm --prefix server test
npm --prefix client test
```

**Backend tests need a MongoDB to talk to.** Point `MONGODB_URI_TEST` at a throwaway server (default `mongodb://127.0.0.1:27017`). Each test file uses its own database named `bike_auction_test_<pid>` and drops it afterwards; the harness refuses to use any other name, and your `MONGODB_URI` is never used.

What is covered: registration/login (duplicates, invalid credentials, expired/forged tokens, CSRF, logout), authorization (buyers/anonymous blocked from admin), listing/search/filter/sort/pagination, bid rules (scheduled/ended/cancelled, below minimum, own listing, already highest, payload validation, no state change on rejection), accepted-bid persistence, **concurrent bidding** (identical and differing amounts, plus crash recovery), lifecycle (activation, winner determination, idempotency, no-winner, deferral), admin create/edit/cancel rules, and Socket.IO (auth, snapshot on join, public/masked broadcast, private outbid, no broadcast on rejected bids, REST/socket parity, status changes). Frontend: auction card, bid form validation, accepted/rejected bid behaviour on the detail page, and loading/error/empty states.

### Results of the runs I performed

| Suite | Result |
| --- | --- |
| Backend (`server`) | **57 passed, 0 failed**; the full suite was run repeatedly (6 consecutive green runs after the final code change) |
| Frontend (`client`) | **20 passed, 0 failed** |
| Production build (`client`) | succeeds |
| Smoke test | Real server process + seeded DB + real Socket.IO client: login, valid and too-low bids, masked broadcast, private outbid event, 403 without CSRF header, 403 buyer→admin, health/ready, graceful SIGTERM shutdown, production cookie flags (`HttpOnly; Secure; SameSite=None`), CORS rejection of an unlisted origin, 413 on an oversized body, fail-fast on missing config |

**Important caveats**

* The sandbox I built this in could not download MongoDB, so the backend tests and smoke test ran against **FerretDB 1.24 (SQLite backend)**, a MongoDB-wire-compatible server, **not real MongoDB or Atlas**. All queries and indexes used are standard, but you should run `npm --prefix server test` against a real MongoDB (local `mongod` or an Atlas dev cluster) before relying on the results, especially the concurrency tests. FerretDB's lack of atomic conditional updates actually shaped the final bidding design (see `docs/architecture.md` §6), which is why the design leans on a unique index, a primitive both databases enforce.
* **No browser/visual testing was done.** I could not run a browser here, so layout, responsiveness, focus styling and the live UI flow were not checked on a real screen. The UI is covered by component tests and a successful build only. Please click through it once.
* No linter is configured.
* Nothing has been deployed.

## Production build

```bash
npm run build          # builds client/dist
npm start              # runs the API (NODE_ENV=production, env vars set)
```

## Deployment

Target: **Vercel** (frontend) + **Render** (API) + **MongoDB Atlas**. None of this has been executed; these are the steps you need to perform.

1. **Atlas**: create a cluster and a database user; under *Network Access* allow Render's outbound IPs (or `0.0.0.0/0` for an assessment, with a strong password). Copy the `mongodb+srv://…` URI and add the database name (e.g. `/bike-auction`).
2. **Render (API)**: *New → Blueprint* from this repo (`render.yaml`), or create a Web Service with root `server`, build `npm ci`, start `npm start`, health check `/api/health`. Set `MONGODB_URI`, `JWT_SECRET` (generated), `CLIENT_URL` (your Vercel URL, no trailing slash), `NODE_ENV=production`. Note the service URL.
3. **Seed**: from your machine, `cd server && MONGODB_URI='<atlas uri>' NODE_ENV=production ADMIN_EMAIL=… ADMIN_PASSWORD=… DEMO_USER_PASSWORD=… node scripts/seed.js --force`. (Or use Render's shell.)
4. **Vercel (web)**: import the repo with root `client`, framework Vite (build `npm run build`, output `dist`). Edit `client/vercel.json` and replace `YOUR-API-NAME.onrender.com` with your Render host. Set the environment variable `VITE_SOCKET_URL=https://<your-api>.onrender.com`. Deploy.
5. **Verify**: open the site, sign in, open a live auction in two browsers and bid; check the "Live updates on" indicator; hit `https://<api>/api/ready`.

Why it's set up this way:

* The `/api/*` rewrite in `vercel.json` makes REST calls **same-origin** from the browser's point of view, so the session cookie is first-party and works in Safari/Firefox/Chrome without third-party-cookie problems. (The cookie is `SameSite=None; Secure`, so a direct cross-origin setup via `VITE_API_URL` also works in browsers that still allow third-party cookies; same-site custom domains are the most robust alternative.)
* WebSockets cannot pass through Vercel rewrites, so the client connects straight to Render (`VITE_SOCKET_URL`) using a short-lived token, which needs no cookies. `CLIENT_URL` must list the Vercel origin for Socket.IO CORS.
* Render's free tier sleeps after inactivity: the first request can take 30–60 s, and WebSocket clients reconnect automatically. The API runs a catch-up lifecycle pass at boot and on every list/detail request, so auctions that ended while it slept are finalized when it wakes.

### Troubleshooting

| Problem | Likely cause |
| --- | --- |
| Login works but you're signed out on refresh | `/api` not routed through the Vercel rewrite and third-party cookies blocked; or `CLIENT_URL` mismatch |
| `CORS_FORBIDDEN` / blocked in console | `CLIENT_URL` must equal the browser origin exactly (scheme + host, no trailing slash); redeploy after changing |
| "Live updates unavailable" | `VITE_SOCKET_URL` missing/wrong (it is baked in at build time, so redeploy the client after changing it) |
| API exits at start | Read the first log line: missing env vars or an Atlas URI/IP allow-list problem |
| Empty site | The database hasn't been seeded |

More failure diagnosis is in `docs/architecture.md` §9.

## Known limitations and trade-offs

* Not deployed or visually verified (see above); backend tests were run on FerretDB, not MongoDB.
* The scheduler is an in-process timer: fine for one instance, redundant (but safe) for several. A dedicated cron would be better at scale. Socket.IO rooms are per-process, so multiple API instances would need a shared adapter (see architecture §10). Redis was deliberately not added.
* Bidding is optimistic: under extreme contention on one auction a request can be told to retry (`BID_CONFLICT` after 10 attempts).
* No max/proxy bidding, anti-sniping extension, reserve prices, payments, email notifications, password reset or email verification (all out of scope).
* Images are URLs only (no uploads). The seeded motorcycles use locally generated SVG illustrations (`client/scripts/generate-bike-images.mjs`), not photographs, because external photo URLs couldn't be verified from the build environment. Paste real image URLs in the admin form to replace them.
* The currency is INR, whole rupees.
* The "my auctions" view caps at 200 auctions per user.
