# page-audit

Full-site audit worker (SEO metadata, links, images, robots.txt, sitemap, security
headers, bot-challenge detection) powered by **Camoufox** (anti-fingerprint Firefox)
driven through `playwright-core`..

## Requirements

- **Node.js >= 22** (required by `camoufox-js` 0.12)
- `playwright-core` must stay **< 1.61** — that is the peer range Camoufox supports.
  Both are pinned in `package.json`; do not loosen them to `latest`/`^`, that is what
  causes "browser executable doesn't exist" style mismatches.

## Run locally

```bash
npm install
npm run fetch-browser   # downloads the Camoufox engine
npm start               # http://localhost:3000
```

CLI:

```bash
node audit.js example.com --out report.json
```

## Docker

```bash
docker build -t page-audit .
docker run -p 3000:3000 page-audit
```

## API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | `{ status, service, activeAudits, queued }` |
| POST | `/api/audit` (alias `/audit`) | body `{ "url": "example.com", ...options }` |
| GET | `/api/audit?url=example.com` | same options as query params |

Options: `navTimeout` (ms), `headless`, `humanize`, `skipRobots`, `skipSitemap`.
Booleans may be sent as `true/false` strings on the GET form.

Set `API_KEY` to require an `X-API-Key` header. Other env vars:
`PORT`, `MAX_CONCURRENT_AUDITS`, `REQUEST_TIMEOUT_MS`, `CAMOUFOX_PATH`.

Responses return HTTP 200 with the report when `ok: true`, 502 with the report when the
page could not be audited, and 4xx/5xx JSON `{ error }` otherwise. CORS is enabled so a
browser frontend can call the worker directly.
