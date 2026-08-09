# Ampcurve — landing page + waitlist

Landing page for **Ampcurve**, a data-driven marketing optimization agency
("marketing that compounds"), with a working waitlist signup.

## What's in here

- `public/` — the static landing page (`index.html`, `styles.css`, `script.js`)
- `server.js` — a tiny Express server that serves the site and stores waitlist
  signups to `data/waitlist.json` (no database or third-party service required)
- `data/waitlist.json` — created automatically on first signup; **git-ignored**
  so real visitor emails never get committed to the repo

## Run it locally

```bash
npm install
npm start
```

Then open http://localhost:3000. Submitting the waitlist form writes to
`data/waitlist.json` and the page shows your position in line (e.g. "You're
#3 on the waitlist!").

## Viewing / exporting signups

Set an admin key so the export endpoint isn't publicly readable:

```bash
cp .env.example .env
# edit .env and set ADMIN_KEY to a long random string, then either:
export ADMIN_KEY=your-long-random-string && npm start
# or set ADMIN_KEY in your hosting provider's environment variable settings
```

Then visit (replace the key):

- `GET /api/admin/export?key=YOUR_ADMIN_KEY` — JSON list of all signups
- `GET /api/admin/export?key=YOUR_ADMIN_KEY&format=csv` — downloadable CSV

Each entry stores: email, the optional "biggest growth priority" answer,
the page path, and any UTM query string it was captured from.

## Deploying

This is a plain Node/Express app, so it runs anywhere Node runs:

1. Push this repo to your host (e.g. your own hosting, Render, Railway, a VPS).
2. Set `ADMIN_KEY` (and optionally `PORT`) as environment variables.
3. Start command: `npm start`.

Note: `data/waitlist.json` lives on local disk, so on hosts with an
ephemeral/read-only filesystem (e.g. most serverless platforms) signups
won't persist across deploys. For a fully serverless setup, swap the
storage in `server.js` for a hosted database (Postgres, SQLite on a volume,
Airtable, Google Sheets, etc.) — the API contract (`POST /api/waitlist`)
can stay the same.

## Editing the copy / branding

- Company name, tagline, and copy live in `public/index.html`.
- Colors and layout live in `public/styles.css` (CSS variables at the top
  of the file control the palette).
- Update the placeholder contact email (`hello@ampcurve.co`) in
  `public/index.html` once you've registered a domain.

## Next steps

- Register a domain (e.g. `ampcurve.co` / `ampcurve.com` / `getampcurve.com`)
  and point it at wherever you deploy this.
- Consider wiring signups to an email tool (e.g. sending a welcome email via
  an SMTP provider) inside the `POST /api/waitlist` handler in `server.js`.
- Add real analytics (e.g. Plausible, Fathom, or GA4) once the domain is live.
