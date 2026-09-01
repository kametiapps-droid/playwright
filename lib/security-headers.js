const TRACKED_HEADERS = [
  'content-security-policy',
  'strict-transport-security',
  'x-frame-options',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
  'x-xss-protection',
];

/** headers: object as returned by playwright response.headers() (lowercased keys). */
export function extractSecurityHeaders(headers = {}) {
  const out = {};
  for (const key of TRACKED_HEADERS) {
    out[key] = headers[key] ?? null;
  }
  return out;
}
