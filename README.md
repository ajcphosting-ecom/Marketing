# Ampcurve — production backend

The software behind Ampcurve, a marketing optimization agency ("marketing
that compounds"): the public landing page, a real waitlist backend, an
admin dashboard for managing leads, and the foundation for a client portal.

## What's in here

```
public/             Static landing page (index.html, styles.css, script.js)
db/                 SQLite schema + migration runner
lib/                Backend logic (waitlist, email, auth, CSRF, client data)
lib/routes/         Express routers: admin dashboard, client portal
lib/integrations/   Data-source connectors (Shopify/Meta/Google Ads/GA4) — stubs
views/              Server-rendered HTML for admin + portal (no build step)
scripts/            One-off CLI scripts (hash a password, seed demo data)
test/               node --test suite (waitlist, admin auth, client management)
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

## Setting up Resend (real outbound email)

The app sends real email through any standard SMTP provider — this is the
walkthrough for [Resend](https://resend.com), the recommended one (free up
to 3,000 emails/month, no credit card to start).

1. **Sign up** at resend.com.
2. **Get sending working immediately (no domain yet):** Resend gives every
   account a shared test address, `onboarding@resend.dev`, that works with
   no setup. Set:
   ```
   MAIL_FROM=Ampcurve <onboarding@resend.dev>
   ```
   Caveat: mail from this address can only be delivered to the email
   address on your own Resend account — fine for testing the wiring, not
   for real waitlist signups.
3. **For real signups to receive email, verify your domain:** in the Resend
   dashboard, Domains → Add Domain → enter your domain (e.g. `ampcurve.co`)
   → Resend gives you 3 DNS records (SPF, DKIM, DMARC) to add at your
   domain registrar. Verification is usually automatic within minutes of
   adding them. Once verified, set:
   ```
   MAIL_FROM=Ampcurve <hello@ampcurve.co>
   ```
   (any address `@` your verified domain works, doesn't need to exist as
   a real inbox).
4. **Create an API key:** Resend dashboard → API Keys → Create API Key.
   Copy it — Resend only shows it once.
5. **Set the SMTP env vars** (in `.env` locally, or your host's/Docker
   Compose's env config in production):
   ```
   SMTP_HOST=smtp.resend.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=resend
   SMTP_PASS=<the API key from step 4>
   ```
   (`SMTP_USER=resend` is literal — that's the username Resend's SMTP relay
   expects, not a placeholder for your own username.)
6. **Test it**:
   ```bash
   npm run test-email -- you@example.com
   ```
   Sends one real email through the config above and reports success/failure.
   If it fails, the error message is Resend's own (e.g. "domain not
   verified", "invalid API key") — fix that before relying on it for real
   signups.
7. Restart the app (`npm start` / redeploy) so it picks up the new env vars.

Full reference: [Resend's SMTP docs](https://resend.com/docs/send-with-smtp).

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

The same login also covers **`/admin/clients`** — creating clients,
inviting their users, and managing their experiments/metrics/integrations.
See "Phase 2: client portal" below.

## Phase 2: client portal

`/portal` is where Ampcurve's clients log in to see their own performance
dashboard. Client management is a real, usable admin feature now — you can
run this with actual clients today, no external accounts required:

- **`/admin/clients`** — create a client, invite their users by email
  (bcrypt-hashed password, set via a one-time invite link — the link is
  also shown directly in the admin UI, so this works even without SMTP
  configured), log experiments and update their status/lift, and enter
  daily ad-spend/revenue numbers by hand (ROAS is always computed
  server-side from what you enter, never trusted as raw input).
- Everything you enter shows up immediately on that client's `/portal`
  dashboard — the same chart and experiments table Phase 1 shipped, now
  fed by real admin input instead of only the seed script.

For a quick demo instead of a real client, `npm run seed:portal` still
works — it creates one demo client ("Brandloop") with 90 days of ROAS
history and five sample experiments, and prints the login it created.

### Live data-source integrations (architecture in place, not connected)

`/admin/clients/:id` also has an **Integrations** panel for Shopify, Meta
Ads, Google Ads, and GA4 — this is the scaffold for pulling spend/revenue
automatically instead of typing it in by hand:

- Credentials you paste in are encrypted at rest (`lib/crypto.js`,
  AES-256-GCM, key from `INTEGRATIONS_ENCRYPTION_KEY`) and stored per
  client/provider in `client_integrations`.
- Each provider has a connector module in `lib/integrations/` with the
  interface `testConnection(credentials)` / `fetchDailyMetrics(credentials,
  { since, until })`. **None of the four are implemented against a real
  API yet** — calling "Sync now" always returns a clear "not implemented"
  error today, recorded on the integration and shown in the admin UI,
  rather than pretending to sync.
- Each connector file (`lib/integrations/shopify.js`, `metaAds.js`,
  `googleAds.js`, `ga4.js`) has a comment block with the exact endpoint,
  required fields, and docs link for what a real implementation needs.

**To connect a real provider:** get API credentials from that platform's
developer console (this always happens outside this codebase — e.g. a
Meta developer app, a Google Ads developer token, a Shopify custom app),
paste them into that integration's form in the admin UI, then implement
`fetchDailyMetrics` in the matching file under `lib/integrations/` so it
calls the real API instead of throwing. It should return
`[{ date, adSpend, revenue }, ...]`; `syncIntegration` in `lib/clients.js`
takes care of writing those into `metrics_snapshots` (tagged with that
provider as the `source`) and updating the integration's status.

Once more than one person per client needs a login, or clients need
different permission levels, that's the next layer to add on top of
`client_users` — nothing here blocks it, it just isn't built yet.

## Security

- `helmet` for standard HTTP security headers.
- Sessions are signed, httpOnly, `sameSite=lax` cookies (no server-side
  session store to run or lose on restart).
- CSRF tokens on every admin/portal form (double-submit pattern).
- Rate limiting on `/api/waitlist` and both login endpoints.
- Admin/client passwords are bcrypt-hashed; nothing sensitive is stored in
  plaintext.
- Integration credentials (Shopify/Meta/Google Ads/GA4 API keys) are
  encrypted at rest with AES-256-GCM before they touch the database.
- Invite links use a 24-byte random token, expire after 7 days, and can
  only be used once.
- `SESSION_SECRET` and `INTEGRATIONS_ENCRYPTION_KEY` are both required
  (the app refuses to boot without them) when `NODE_ENV=production`.

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
matter for a production launch: `SESSION_SECRET`, `INTEGRATIONS_ENCRYPTION_KEY`,
`ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `APP_BASE_URL` (so invite links point
at your real domain), and the `SMTP_*` vars — see "Setting up Resend" above;
skip them and email just logs to the console instead of sending. After
setting them, confirm with `npm run test-email -- you@example.com` before
relying on them for real signups.

## Tests

```bash
npm test
```

Runs against an isolated in-memory SQLite database (no state leaks between
runs). 21 tests covering: waitlist validation/dedup/honeypot/rate-limiting,
admin login/CSRF/session auth, client creation, the invite → accept-invite
→ logged-in-portal flow (including single-use enforcement), manual metric
entry (server-computed ROAS), the integration credential
encryption/sync-failure path, and SMTP transport config (including the
exact Resend settings) — that last one is config-shape only, it doesn't
send real email, so it needs no real credentials to run in CI.

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
