#!/usr/bin/env node

const { Camoufox } = require('camoufox');

/**
 * Normalizes input string to an absolute URL format.
 * Defaults to 'https://' protocol if missing.
 */
function normalizeUrl(input) {
    let urlStr = input.trim();
    if (!/^https?:\/\//i.test(urlStr)) {
        urlStr = 'https://' + urlStr;
    }
    try {
        return new URL(urlStr).href;
    } catch (e) {
        return null;
    }
}

/**
 * Main function to execute website audit using Camoufox stealth profile.
 */
async function runAudit() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error(JSON.stringify({ error: "Please provide a URL. Example: node audit.js example.com" }));
        process.exit(1);
    }

    const targetUrl = normalizeUrl(args[0]);
    if (!targetUrl) {
        console.error(JSON.stringify({ error: "Invalid URL provided." }));
        process.exit(1);
    }

    // Initialize structured output tracking standard schema
    const report = {
        url: targetUrl,
        finalUrl: null,
        statusCode: null,
        ok: false,
        title: null,
        description: null,
        linksCount: 0,
        imagesCount: 0,
        securityHeaders: {
            "content-security-policy": null,
            "strict-transport-security": null,
            "x-frame-options": null,
            "x-content-type-options": null,
            "referrer-policy": null,
            "permissions-policy": null,
            "x-xss-protection": null
        },
        error: null,
        timestamp: new Date().toISOString()
    };

    let browser = null;
    try {
        // Launch anti-fingerprinting stealth browser profile natively
        browser = await Camoufox.launch({
            headless: true,
            fingerprintOptions: {
                modifyFeatures: true,
                randomizeMemory: true
            }
        });

        const context = await browser.newContext({
            ignoreHTTPSErrors: true // Matches your original TLS settings
        });

        const page = await context.newPage();

        // Track network response maps to catch the primary target document status
        let mainResponse = null;
        page.on('response', (response) => {
            const resUrl = response.url().replace(/\/$/, "");
            const checkUrl = targetUrl.replace(/\/$/, "");
            if (resUrl === checkUrl) {
                mainResponse = response;
            }
        });

        // Navigate directly to destination
        const navigationResponse = await page.goto(targetUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        const finalResponse = mainResponse || navigationResponse;

        if (finalResponse) {
            report.statusCode = finalResponse.status();
            report.ok = finalResponse.ok();
            report.finalUrl = page.url();

            // Extract security headers into predefined keys mapping
            const headers = finalResponse.headers();
            Object.keys(report.securityHeaders).forEach(headerName => {
                report.securityHeaders[headerName] = headers[headerName.toLowerCase()] || null;
            });
        }

        // Wait to allow automated Turnstile verification context clearance to resolve
        const cloudflareFrame = page.frames().find(f => f.url().includes('://cloudflare.com'));
        if (cloudflareFrame) {
            await page.waitForTimeout(5000);
        }

        // Catch network stability thresholds safely to avoid crashing on lazy-loading analytic sockets
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
            // Suppress background script persistence timeouts gracefully
        });

        // Parse DOM structural properties safely
        report.title = await page.title().catch(() => null);
        
        report.description = await page.evaluate(() => {
            const meta = document.querySelector('meta[name="description"]') || 
                         document.querySelector('meta[property="og:description"]');
            return meta ? meta.getAttribute('content') : null;
        }).catch(() => null);

        report.linksCount = await page.evaluate(() => document.querySelectorAll('a[href]').length).catch(() => 0);
        report.imagesCount = await page.evaluate(() => document.querySelectorAll('img').length).catch(() => 0);

        // Success JSON print output
        console.log(JSON.stringify(report, null, 2));

    } catch (err) {
        report.error = err.message;
        console.log(JSON.stringify(report, null, 2));
        process.exit(1);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

runAudit();
