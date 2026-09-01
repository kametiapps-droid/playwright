import { launchBrowser } from './lib/browser.js';
import { detectChallenge, waitOutChallenge } from './lib/challenge.js';
import { auditRobotsTxt } from './lib/robots.js';
import { auditSitemap } from './lib/sitemap.js';
import { extractPageData, classifyLinks, summarizeImages } from './lib/page-data.js';
import { extractSecurityHeaders } from './lib/security-headers.js';

function normalizeUrl(input) {
  if (!/^https?:\/\//i.test(input)) return `https://${input}`;
  return input;
}

/**
 * Run a full audit of a single URL.
 *
 * @param {string} rawUrl
 * @param {object} options
 * @param {number} [options.navTimeout=30000] ms to wait for navigation
 * @param {boolean} [options.headless=true]
 * @param {boolean} [options.humanize=true] Camoufox human-like cursor/typing behavior
 * @param {boolean} [options.skipRobots=false]
 * @param {boolean} [options.skipSitemap=false]
 * @returns {Promise<object>} JSON-serializable audit report
 */
export async function runAudit(rawUrl, options = {}) {
  const {
    navTimeout = 30000,
    headless = true,
    humanize = true,
    skipRobots = false,
    skipSitemap = false,
  } = options;

  const url = normalizeUrl(rawUrl);
  const timestamp = new Date().toISOString();

  let browser;
  try {
    browser = await launchBrowser({ headless, humanize });
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    context.setDefaultTimeout(navTimeout);
    const page = await context.newPage();

    let response;
    try {
      response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: navTimeout });
    } catch (navErr) {
      return {
        url,
        finalUrl: null,
        statusCode: null,
        ok: false,
        error: `Navigation failed: ${navErr.message}`,
        timestamp,
      };
    }

    // Give network activity a chance to settle, but don't let a chatty page
    // (ads, analytics, websockets) hold the whole audit hostage.
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});

    let html = await page.content();
    let challengeType = detectChallenge(html);
    let challengeBypassed = null;

    if (challengeType) {
      const result = await waitOutChallenge(page);
      challengeBypassed = result.cleared;
      html = result.html;
    }

    const finalUrl = page.url();
    const origin = new URL(finalUrl).origin;
    const statusCode = response ? response.status() : null;
    const headers = response ? response.headers() : {};

    const pageData = await extractPageData(page);
    const links = classifyLinks(pageData.links, origin);
    const images = summarizeImages(pageData.images);
    const securityHeaders = extractSecurityHeaders(headers);

    const robots = skipRobots
      ? null
      : await auditRobotsTxt(context, origin).catch((err) => ({ error: err.message }));

    const sitemap = skipSitemap
      ? null
      : await auditSitemap(context, origin, robots?.sitemaps || []).catch((err) => ({
          error: err.message,
        }));

    return {
      url,
      finalUrl,
      statusCode,
      ok: !!statusCode && statusCode >= 200 && statusCode < 400,
      title: pageData.title,
      description: pageData.metaDescription,
      canonical: pageData.canonical,
      lang: pageData.lang,
      h1Count: pageData.h1Count,
      botChallenge: {
        detected: !!challengeType,
        type: challengeType,
        bypassed: challengeBypassed,
      },
      links,
      images,
      securityHeaders,
      robots,
      sitemap,
      error: null,
      timestamp,
    };
  } catch (err) {
    return {
      url,
      finalUrl: null,
      statusCode: null,
      ok: false,
      error: err.message,
      timestamp,
    };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
