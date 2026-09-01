import { Camoufox } from 'camoufox-js';

/**
 * Launch a Camoufox (anti-fingerprint Firefox) browser instance.
 * Camoufox patches navigator/canvas/WebGL/font fingerprints at the browser
 * level, which is what lets it sail through passive bot-detection checks
 * (Cloudflare's "Just a moment..." JS challenge, basic Turnstile widgets)
 * that a stock headless Chromium usually gets flagged by.
 *
 * It cannot solve interactive CAPTCHAs that require a human (image grids,
 * audio challenges) — see lib/challenge.js for what we do about those.
 */
export async function launchBrowser({
  headless = true,
  humanize = true,
  geoip = false,
  blockImages = false,
} = {}) {
  return Camoufox({
    headless,
    humanize,
    geoip,
    block_images: blockImages,
    // Keep a normal-looking viewport; wildly uncommon sizes are themselves
    // a fingerprinting signal.
    window: [1366, 768],
  });
}
