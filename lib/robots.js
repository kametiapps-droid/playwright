/**
 * Fetch and lightly parse robots.txt for a given origin using the browser
 * context's request API (so it goes through the same fingerprint-patched
 * network stack as the page navigation).
 */
export async function auditRobotsTxt(context, origin, { timeout = 15000 } = {}) {
  const url = new URL('/robots.txt', origin).toString();

  try {
    const res = await context.request.get(url, { timeout, failOnStatusCode: false });
    const status = res.status();
    const exists = res.ok();

    if (!exists) {
      return { url, exists: false, status, sitemaps: [], disallowCount: 0, userAgentCount: 0, raw: null };
    }

    const body = await res.text();
    const lines = body.split(/\r?\n/).map((l) => l.trim());

    const sitemaps = lines
      .filter((l) => /^sitemap:/i.test(l))
      .map((l) => l.replace(/^sitemap:/i, '').trim())
      .filter(Boolean);

    const disallowCount = lines.filter((l) => /^disallow:/i.test(l)).length;
    const allowCount = lines.filter((l) => /^allow:/i.test(l)).length;
    const userAgentCount = lines.filter((l) => /^user-agent:/i.test(l)).length;

    return {
      url,
      exists: true,
      status,
      sitemaps,
      disallowCount,
      allowCount,
      userAgentCount,
      raw: body.slice(0, 5000), // cap for sanity
    };
  } catch (err) {
    return { url, exists: false, status: null, error: err.message, sitemaps: [], disallowCount: 0, userAgentCount: 0, raw: null };
  }
}
