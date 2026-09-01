#!/usr/bin/env node
/**
 * page-audit.js
 *
 * Opens a URL with Playwright + Chromium and reports:
 *   - HTTP status code
 *   - page title
 *   - meta description
 *   - count of links (<a href>)
 *   - count of images (<img>)
 *   - presence/value of common security headers
 *
 * Usage:
 *   node audit.js <url>
 *   node audit.js https://example.com
 *
 * Output: JSON printed to stdout.
 */

const { chromium } = require('playwright');

const SECURITY_HEADERS = [
  'content-security-policy',
  'strict-transport-security',
  'x-frame-options',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
  'x-xss-protection',
];

function normalizeUrl(input) {
  if (!/^https?:\/\//i.test(input)) {
    return `https://${input}`;
  }
  return input;
}

async function auditUrl(rawUrl) {
  const url = normalizeUrl(rawUrl);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  const result = {
    url,
    finalUrl: null,
    statusCode: null,
    ok: false,
    title: null,
    description: null,
    linksCount: 0,
    imagesCount: 0,
    securityHeaders: {},
    error: null,
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    if (!response) {
      throw new Error('No response received from page.goto');
    }

    result.finalUrl = page.url();
    result.statusCode = response.status();
    result.ok = response.ok();

    // Title
    result.title = await page.title();

    // Meta description
    result.description = await page.evaluate(() => {
      const meta =
        document.querySelector('meta[name="description"]') ||
        document.querySelector('meta[property="og:description"]');
      return meta ? meta.getAttribute('content') : null;
    });

    // Links & images count
    result.linksCount = await page.$$eval('a[href]', (els) => els.length);
    result.imagesCount = await page.$$eval('img', (els) => els.length);

    // Security headers
    const headers = response.headers();
    for (const key of SECURITY_HEADERS) {
      result.securityHeaders[key] = headers[key] || null;
    }
  } catch (err) {
    result.error = err.message;
  } finally {
    await browser.close();
  }

  return result;
}

async function main() {
  const rawUrl = process.argv[2];

  if (!rawUrl) {
    console.error('Usage: node audit.js <url>');
    process.exit(1);
  }

  const result = await auditUrl(rawUrl);
  console.log(JSON.stringify(result, null, 2));

  if (result.error) {
    process.exit(1);
  }
}

module.exports = { auditUrl };
