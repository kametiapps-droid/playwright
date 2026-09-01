/**
 * Signatures for the interstitial / bot-check pages we might land on
 * instead of the real page. Order matters slightly (more specific first)
 * but detection just returns the first match.
 */
const CHALLENGE_SIGNATURES = [
  {
    name: 'cloudflare-turnstile',
    test: (html) => /cf-turnstile|challenges\.cloudflare\.com\/turnstile/i.test(html),
  },
  {
    name: 'cloudflare-interstitial',
    test: (html) =>
      /Just a moment\.\.\.|Checking your browser before accessing|cf-browser-verification|cf_chl_/i.test(
        html
      ),
  },
  {
    name: 'recaptcha',
    test: (html) => /google\.com\/recaptcha|grecaptcha\.render|grecaptcha\.execute/i.test(html),
  },
  {
    name: 'hcaptcha',
    test: (html) => /hcaptcha\.com\/1\/api\.js|h-captcha/i.test(html),
  },
  {
    name: 'generic-access-denied',
    test: (html) => /Access Denied|Attention Required!|Please verify you are a human/i.test(html),
  },
];

export function detectChallenge(html) {
  for (const sig of CHALLENGE_SIGNATURES) {
    if (sig.test(html)) return sig.name;
  }
  return null;
}

/**
 * Cloudflare's JS interstitial and passive Turnstile widgets often clear
 * themselves within a few seconds once a browser passes the fingerprint
 * checks — which is exactly what Camoufox is built to do. This polls the
 * page a few times and returns whether the challenge signature disappeared.
 *
 * It does NOT click checkboxes, solve image puzzles, or call any third
 * party CAPTCHA-solving API — there's a hook below (resolveWithExternalSolver)
 * if you want to wire one in with your own API key.
 */
export async function waitOutChallenge(page, { attempts = 6, intervalMs = 1500 } = {}) {
  let lastHtml = await page.content();
  let challenge = detectChallenge(lastHtml);

  for (let i = 0; i < attempts && challenge; i++) {
    await page.waitForTimeout(intervalMs);
    lastHtml = await page.content();
    challenge = detectChallenge(lastHtml);
  }

  return { cleared: !challenge, remainingChallenge: challenge, html: lastHtml };
}

/**
 * Optional hook: if you have a CAPTCHA-solving service (2Captcha, CapSolver,
 * etc.) you can implement this to actually submit the sitekey and inject the
 * solved token. Left unimplemented on purpose — no external API key is
 * configured here. Throws by design so callers know it's a no-op.
 */
export async function resolveWithExternalSolver() {
  throw new Error(
    'No external CAPTCHA solver configured. Set CAPTCHA_SOLVER_API_KEY and implement lib/challenge.js#resolveWithExternalSolver to enable one.'
  );
}
