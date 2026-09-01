/**
 * Fetch and lightly inspect a sitemap (or sitemap index) without pulling in
 * a full XML parser dependency — we only need counts and validity, not a
 * DOM, and regexes on well-formed sitemap XML are reliable enough for that.
 */
async function fetchOne(context, url, timeout) {
  try {
    const res = await context.request.get(url, { timeout, failOnStatusCode: false });
    const status = res.status();
    if (!res.ok()) {
      return { url, status, exists: false };
    }
    const body = await res.text();
    const looksLikeXml = /<\?xml|<urlset|<sitemapindex/i.test(body.slice(0, 500));
    const isIndex = /<sitemapindex/i.test(body);
    const urlCount = (body.match(/<loc>/gi) || []).length;

    return {
      url,
      status,
      exists: true,
      validXml: looksLikeXml,
      isSitemapIndex: isIndex,
      urlCount,
      sizeBytes: Buffer.byteLength(body, 'utf8'),
    };
  } catch (err) {
    return { url, status: null, exists: false, error: err.message };
  }
}

export async function auditSitemap(context, origin, robotsSitemaps = [], { timeout = 15000 } = {}) {
  const candidates =
    robotsSitemaps.length > 0
      ? robotsSitemaps
      : [new URL('/sitemap.xml', origin).toString()];

  const results = [];
  // Cap how many candidate sitemaps we actually fetch to keep an audit fast.
  for (const url of candidates.slice(0, 5)) {
    results.push(await fetchOne(context, url, timeout));
  }

  const found = results.filter((r) => r.exists);

  return {
    checked: results,
    found: found.length > 0,
    totalUrlsAcrossFound: found.reduce((sum, r) => sum + (r.urlCount || 0), 0),
  };
}
