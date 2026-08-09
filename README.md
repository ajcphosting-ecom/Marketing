# Ampcurve — production backend

The software behind Ampcurve, a marketing optimization agency ("marketing
that compounds"): the public landing page, a real waitlist backend, an
admin dashboard for managing leads, and the foundation for a client portal.

## What's in here

```
public/            Static landing page (index.html, styles.css, script.js)
db/                 SQLite schema + migration runner
lib/                Backend logic (waitlist, email, auth, CSRF, portal data)
lib/routes/         Express routers: admin dashboard, client portal
views/              Server-rendered HTML for admin + portal (no build step)
scripts/            One-off CLI scripts (hash a password, seed demo data)
test/               node --test suite for the waitlist API + admin auth
server.js           Express app: wires everything together
Dockerfile, docker-compose.yml   Production deploy
```

**Stack:** Node.js + Express + SQLite (`better-sqlite3`), server-rendered
HTML (no frontend framework/build step), session auth via signed cookies.
No paid services required to run it — email defaults to console logging
until you plug in an SMTP provider.

## Quick start (local)

```bash
npm install
cp .env.example .env
```

Edit `.env`:
- `SESSION_SECRET` — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `ADMIN_EMAIL` — the email you'll log into `/admin` with
- `ADMIN_PASSWORD_HASH` — generate with `npm run hash-password -- "your-long-password"`

Then:

```bash
npm start
```

- Landing page: http://localhost:3000
- Admin dashboard: http://localhost:3000/admin/login
- Client portal: http://localhost:3000/portal/login (see "Phase 2" below —
  empty until you seed demo data)

`npm run dev` runs the same thing with `node --watch` for auto-reload.

## The waitlist

`POST /api/waitlist` (called by the landing page form) validates the email,
rejects duplicates (case-insensitive), silently drops bot submissions
(hidden honeypot field), and is rate-limited to 8 requests / 10 minutes per
IP. A successful signup:

1. Is stored in SQLite (`waitlist_signups` table).
2. Triggers a welcome email to the signup (if SMTP is configured).
3. Optionally notifies you at `ADMIN_NOTIFY_EMAIL` (if set).

Email sending never blocks the API response — if SMTP isn't configured,
emails are logged to the console instead so everything still works in dev.

## Admin dashboard

`/admin` is a session-protected dashboard (single admin account, configured
via `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH` — there's no user database for
this, on purpose, since it's one founder's login):

- Stats: total signups, today, last 7 days, contacted.
- Searchable/filterable leads table with pagination.
- Mark a lead "contacted" from the table.
- Export all leads as CSV.

Login is rate-limited (10 attempts / 15 min) and CSRF-protected. This
replaces the old `?key=...` query-param export from the prototype version —
everything admin-related now requires a real login.

## Phase 2: client portal (foundation, not yet wired to real data)

`/portal` is where Ampcurve's clients will eventually log in to see their
own performance dashboard. The plumbing is real — a `clients` /
`client_users` table, bcrypt-hashed passwords, session auth, a dashboard
that reads `experiments` and `metrics_snapshots` from the database and
renders a real chart — but there's no ad-platform or analytics integration
behind it yet. It's seeded with realistic demo numbers so you can see the
shape of the product:

```bash
npm run seed:portal
# or with your own demo credentials:
npm run seed:portal -- you@example.com a-demo-password
```

This creates one demo client ("Brandloop") with 90 days of ROAS history and
five sample experiments, and prints the login it created.

**To actually launch this as a product**, the next steps are: an
integration to pull real spend/revenue (Meta/Google Ads APIs, Shopify,
GA4, or a CDP), a way to create real clients + invite their users (right
now `lib/portal.js` has `createClient`/`createClientUser` helpers but no
UI — you'd add an admin action or a signed invite-link flow), and probably
per-client role/permission handling once more than one person per client
needs a login.

## Security

- `helmet` for standard HTTP security headers.
- Sessions are signed, httpOnly, `sameSite=lax` cookies (no server-side
  session store to run or lose on restart).
- CSRF tokens on every admin/portal form (double-submit pattern).
- Rate limiting on `/api/waitlist` and both login endpoints.
- Admin/client passwords are bcrypt-hashed; nothing sensitive is stored in
  plaintext.
- `SESSION_SECRET` is required (the app refuses to boot without one) when
  `NODE_ENV=production`.

## Deploying

### Docker Compose (recommended)

```bash
cp .env.example .env   # fill in SESSION_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD_HASH
docker compose up -d --build
```

The SQLite file lives in a named volume (`ampcurve_data`), so it survives
`docker compose down` / redeploys. To back it up:

```bash
docker run --rm -v ampcurve_marketing_ampcurve_data:/data -v "$PWD":/backup \
  alpine cp /data/ampcurve.sqlite /backup/ampcurve-backup.sqlite
```

Put a reverse proxy (nginx, Caddy, or your host's built-in one) in front
for TLS — the app itself speaks plain HTTP and trusts the first proxy hop
(`app.set('trust proxy', 1)`) for rate limiting and secure cookies to work
correctly behind it.

### Manual (any VPS with Node 18+)

```bash
npm ci --omit=dev
npm run migrate
ADMIN_PASSWORD_HASH=... SESSION_SECRET=... NODE_ENV=production npm start
```

Run it under a process manager (systemd, pm2) so it restarts on crash/boot,
and put nginx/Caddy in front for TLS + to serve as the reverse proxy.

### Environment variables reference

See `.env.example` for the full list with explanations. The ones that
matter for a production launch: `SESSION_SECRET`, `ADMIN_EMAIL`,
`ADMIN_PASSWORD_HASH`, and the `SMTP_*` vars (skip these and email just
logs to the console instead of sending).

## Tests

```bash
npm test
```

Runs against an isolated in-memory SQLite database (no state leaks between
runs). Covers: waitlist validation/dedup/honeypot/rate-limiting, and admin
login/CSRF/session auth.

## Editing the landing page

Company name, tagline, and copy live in `public/index.html`; colors and
type in `public/styles.css` (CSS variables at the top). Update the
placeholder contact email (`hello@ampcurve.co`) once you've registered a
domain.

## Next steps

- Register a domain and point it at wherever you deploy this.
- Configure a real SMTP provider so waitlist welcome emails actually send.
- Decide on the Phase 2 integration (which ad platforms / analytics source
  feed the client portal) before selling access to it.
- Add real analytics (Plausible, Fathom, GA4) to the public site once live.
