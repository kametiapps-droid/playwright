# page-audit

Audits a URL using Playwright + Chromium and prints a JSON report containing:

- HTTP status code
- Page title
- Meta description
- Link count (`<a href>`)
- Image count (`<img>`)
- Basic security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-XSS-Protection)

## Setup

```bash
npm install
npx playwright install chromium
```

## Usage

```bash
node audit.js https://example.com
```

Or without the protocol (defaults to https):

```bash
node audit.js example.com
```

## Example output

```json
{
  "url": "https://example.com",
  "finalUrl": "https://example.com/",
  "statusCode": 200,
  "ok": true,
  "title": "Example Domain",
  "description": null,
  "linksCount": 1,
  "imagesCount": 0,
  "securityHeaders": {
    "content-security-policy": null,
    "strict-transport-security": "max-age=63072000",
    "x-frame-options": null,
    "x-content-type-options": "nosniff",
    "referrer-policy": null,
    "permissions-policy": null,
    "x-xss-protection": null
  },
  "error": null,
  "timestamp": "2026-09-02T12:00:00.000Z"
}
```

## Docker

Build:

```bash
docker build -t page-audit .
```

Run:

```bash
docker run --rm page-audit https://example.com
```

The image is based on `mcr.microsoft.com/playwright:v1.47.0-jammy`, which ships Chromium and all required OS dependencies pre-installed, so no `playwright install` step is needed inside the container.

## Notes

- Uses `networkidle` wait strategy with a 30s timeout — adjust in `audit.js` for slower sites.
- `ignoreHTTPSErrors: true` is set so audits of misconfigured-TLS sites still complete.
- On navigation failure, `error` is populated and the process exits with code 1; other fields remain `null`.
