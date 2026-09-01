# page-audit

Full-site audit tool built on [Camoufox](https://camoufox.com) (an anti-fingerprint
Firefox build) driven through Playwright. Point it at a URL and it reports:

- HTTP status code, final URL (after redirects), title, meta description, canonical, `<html lang>`, H1 count
- **Links** — total, internal vs. external counts, unique lists
- **Images** — total count, how many are missing (or have empty) `alt` text, with sample offenders
- **robots.txt** — exists/status, declared `Sitemap:` entries, `Disallow`/`Allow`/`User-agent` line counts
- **sitemap.xml** — found/valid, whether it's a sitemap index, URL count
- **Security headers** — CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-XSS-Protection
- **Bot-challenge detection** — flags Cloudflare Turnstile / "Just a moment..." interstitials, reCAPTCHA, hCaptcha, and whether the page cleared on its own after a short wait

## Why Camoufox

Camoufox patches the browser's own fingerprint (canvas, WebGL, fonts, `navigator.*`)
rather than trying to fake it from JS, which is what lets it pass **passive**
bot checks — Cloudflare's JS interstitial and many Turnstile widgets — that a
stock headless Chromium usually gets flagged by. It does **not** solve
interactive CAPTCHAs that require a human (image grids, audio challenges).
`lib/challenge.js` has a documented, unimplemented hook
(`resolveWithExternalSolver`) if you want to wire in a paid solving service —
no such key is configured here.

## Setup

```bash
npm install
npx camoufox-js fetch   # downloads the Camoufox browser binary
```

## CLI usage

```bash
node audit.js https://example.com
node audit.js example.com --out report.json
node audit.js example.com --skip-sitemap --timeout 15000
```

Run `node audit.js --help` for all flags.

## HTTP API

```bash
npm start   # or: node server.js
```

```bash
curl -X POST http://localhost:3000/api/audit \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://example.com"}'

# or
curl 'http://localhost:3000/api/audit?url=example.com'

curl http://localhost:3000/health
```

Config via env vars (see `.env.example`):

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `API_KEY` | unset | If set, required as `X-API-Key` header on `/api/audit` |
| `MAX_CONCURRENT_AUDITS` | `3` | Caps simultaneous browser instances (each audit launches one) |

## Example output (abridged)

```json
{
  "url": "https://example.com",
  "finalUrl": "https://example.com/",
  "statusCode": 200,
  "ok": true,
  "title": "Example Domain",
  "botChallenge": { "detected": false, "type": null, "bypassed": null },
  "links": { "totalCount": 12, "internalCount": 9, "externalCount": 3 },
  "images": { "totalCount": 4, "withAltCount": 3, "missingAltCount": 1 },
  "robots": { "exists": true, "sitemaps": ["https://example.com/sitemap.xml"] },
  "sitemap": { "found": true, "totalUrlsAcrossFound": 143 },
  "securityHeaders": { "strict-transport-security": "max-age=63072000" },
  "timestamp": "2026-09-02T12:00:00.000Z"
}
```

Run without `--out`/hitting `/api/audit` for the full report — the above
trims the `internalUnique`/`externalUnique`/`missingAltSamples` arrays for
brevity.

## Docker

```bash
docker build -t page-audit .
docker run --rm -p 3000:3000 page-audit
```

The image installs the OS-level libraries Camoufox's Firefox engine needs
and pre-fetches the browser binary at build time, so no `camoufox-js fetch`
step is needed inside the running container.

## Notes / limitations

- Navigation uses `domcontentloaded` + a best-effort 8s `networkidle` wait
  (not a hard requirement) — some sites (ads, analytics, websockets) never
  go fully idle.
- `ignoreHTTPSErrors: true` is set so audits of misconfigured-TLS sites still complete.
- On navigation failure, `error` is populated and `ok` is `false`; other
  fields are omitted rather than nulled-out garbage.
- Sitemap parsing is regex-based (`<loc>` counting), not a full XML parser —
  fine for counts/validity, not for extracting individual URLs.
- Bot-challenge bypass is best-effort. `botChallenge.bypassed: false` means
  the page still looked like a challenge after the wait window — you may be
  looking at a real CAPTCHA that needs a solving service or a Turnstile
  configuration stricter than passive fingerprint checks can clear.
