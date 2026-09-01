const { Camoufox } = require('camoufox');

/**
 * Normalizes input string to an absolute URL format.
 */
function normalizeUrl(input) {
    if (!input || typeof input !== 'string') return null;
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
 * Audits a target URL using an anti-fingerprint browser engine.
 */
async function auditUrl(inputUrl) {
    const targetUrl = normalizeUrl(inputUrl);
    if (!targetUrl) {
        return { error: "Invalid URL provided." };
    }

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
        // Launch Camoufox using the native configuration object structure
        browser = await Camoufox.launch({
            headless: true,
            fingerprintOptions: {
                modifyFeatures: true,
                randomizeMemory: true
            }
        });

        const context = await browser.newContext({
            ignoreHTTPSErrors: true
        });

        const page = await context.newPage();

        // Capture headers dynamically on redirection pathways
        let mainResponse = null;
        page.on('response', (response) => {
            const resUrl = response.url().replace(/\/$/, "");
            const checkUrl = targetUrl.replace(/\/$/, "");
            if (resUrl === checkUrl || response.request().isNavigationRequest()) {
                mainResponse = response;
            }
        });

        const navigationResponse = await page.goto(targetUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        const finalResponse = mainResponse || navigationResponse;

        if (finalResponse) {
            report.statusCode = finalResponse.status();
            report.ok = finalResponse.ok();
            report.finalUrl = page.url();

            const headers = finalResponse.headers();
            Object.keys(report.securityHeaders).forEach(headerName => {
                report.securityHeaders[headerName] = headers[headerName.toLowerCase()] || null;
            });
        }

        // Monitor if a Cloudflare verification widget is actively computing fingerprints
        const cloudflareFrame = page.frames().find(f => f.url().includes('://cloudflare.com'));
        if (cloudflareFrame) {
            // Sleep briefly to let Turnstile clear the session context seamlessly
            await page.waitForTimeout(5000);
        }

        // Ensure stability without crashing if analytics trackers hang
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

        // Process SEO fields safely
        report.title = await page.title().catch(() => null);
        
        report.description = await page.evaluate(() => {
            const meta = document.querySelector('meta[name="description"]') || 
                         document.querySelector('meta[property="og:description"]');
            return meta ? meta.getAttribute('content') : null;
        }).catch(() => null);

        report.linksCount = await page.evaluate(() => document.querySelectorAll('a[href]').length).catch(() => 0);
        report.imagesCount = await page.evaluate(() => document.querySelectorAll('img').length).catch(() => 0);

        return report;

    } catch (err) {
        report.error = err.message;
        return report;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Export module for server.js consumption
module.exports = { auditUrl };
