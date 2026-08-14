# CARE Ops Board

Creative Appeal Real Estate's operations board — capture a job the second it lands,
triage it later, work only from Today.

Originally a Claude artifact; rebuilt here as a standalone, installable web app so
it can be opened from a phone on site.

## What it does

- **Capture** — one box at the top. Anything that comes up goes straight in.
- **Triage** — tap an item to tag it (Check-in, Maintenance, Call, Email, Concern,
  Admin) and move it to Today / This Week / Waiting.
- **Ageing** — items turn amber at 2 days in the Inbox (5 elsewhere) and red at
  4 / 7. A banner counts anything at risk, so nothing quietly rots.
- **Waiting** — record who you're waiting on, so chasing is a list rather than a memory.
- **Back up / Restore** — under *how it works*. Exports the board as JSON.

## iPhone notes

- Installable: **Share → Add to Home Screen**. It then runs full screen with its own
  icon, no Safari chrome, and opens with no signal.
- Inputs are 16px so iOS doesn't zoom the page when you tap a field.
- Tap targets are ≥44px, safe-area insets are respected on notched devices, and
  double-tap zoom is disabled so taps register immediately.
- Brand fonts are self-hosted — no third-party request, and they render offline.

## Where the data lives

In `localStorage`, on the device, under the key `care-ops-v1`. Nothing is sent to a
server; the server in this repo only serves static files.

That means **the board does not sync between phones** — Uzair's board and a
colleague's board are separate. It also means clearing Safari's website data wipes
it, which is what the Back up button is for. If you later want one shared board
across the team, that needs a database and login; the storage layer is isolated in
`src/storage.js` to make that swap straightforward.

## Running locally

```bash
npm install
npm run dev          # http://localhost:5173
```

Production build, exactly as Railway runs it:

```bash
npm run build
npm start            # http://localhost:3000
```

## Tests

Playwright drives an iPhone 13 viewport: adds tasks, tags and moves one, reloads to
prove persistence, checks the manifest and service worker, audits tap-target sizes,
then cuts the network to confirm the board still opens offline.

```bash
npm i -D playwright
npm run build && PORT=3111 node server.js &
node test/iphone.test.mjs
node test/offline.test.mjs
```

## Deploying to Railway

1. Push this repo to GitHub.
2. Railway → **New Project → Deploy from GitHub repo** → pick the repo.
3. Railway reads `railway.json`: it runs `npm ci && npm run build`, then `npm start`.
   No environment variables are needed — `PORT` is injected automatically.
4. **Settings → Networking → Generate Domain** to get a public URL.

Health check: `GET /healthz`.

> A PWA needs HTTPS to install. Railway-generated domains are HTTPS, so this works
> out of the box.

## Layout

```
index.html              app shell, PWA + iOS meta tags
server.js               Express static server, SPA fallback, health check
railway.json            build and deploy config
src/
  main.jsx              React entry, service worker registration
  CareOpsBoard.jsx      the board
  storage.js            localStorage shim (swap here for a backend)
public/
  manifest.webmanifest  PWA manifest
  sw.js                 service worker — offline shell
  logo.png              CARE logo
  icons/                app icons, incl. maskable and apple-touch
  fonts/                self-hosted Archivo + Public Sans
```
