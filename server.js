import express from 'express';
import cors from 'cors';
import { runAudit } from './auditor.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const API_KEY = process.env.API_KEY || null;
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_AUDITS || '3', 10);
const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || '120000', 10);

const app = express();
app.use(cors());
app.use(express.json({ limit: '128kb' }));

// --- tiny concurrency gate -------------------------------------------------
// Each audit spins up a full browser instance, which is heavy. Rather than
// let unlimited concurrent requests exhaust memory, queue anything past
// MAX_CONCURRENT.
let active = 0;
const queue = [];

function runQueued(task) {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (active >= MAX_CONCURRENT) {
        queue.push(attempt);
        return;
      }
      active++;
      task()
        .then(resolve, reject)
        .finally(() => {
          active--;
          const next = queue.shift();
          if (next) next();
        });
    };
    attempt();
  });
}

// --- auth (optional) --------------------------------------------------------
function checkApiKey(req, res, next) {
  if (!API_KEY) return next(); // auth disabled unless API_KEY is set
  const provided = req.header('x-api-key');
  if (provided !== API_KEY) {
    return res.status(401).json({ error: 'Invalid or missing X-API-Key header' });
  }
  next();
}

const BOOLEAN_OPTIONS = ['headless', 'humanize', 'skipRobots', 'skipSitemap'];

/** Query strings arrive as strings ("false" is truthy) — coerce them properly. */
function normalizeOptions(raw = {}) {
  const options = { ...raw };
  for (const key of BOOLEAN_OPTIONS) {
    if (typeof options[key] === 'string') {
      options[key] = !/^(false|0|no)$/i.test(options[key]);
    }
  }
  if (typeof options.navTimeout === 'string') {
    const parsed = parseInt(options.navTimeout, 10);
    if (Number.isFinite(parsed)) options.navTimeout = parsed;
    else delete options.navTimeout;
  }
  return options;
}

async function handleAudit(req, res, url, rawOptions) {
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: '"url" (string) is required' });
  }

  res.setTimeout?.(REQUEST_TIMEOUT_MS);

  try {
    const report = await runQueued(() => runAudit(url, normalizeOptions(rawOptions)));
    res.status(report.ok ? 200 : 502).json(report);
  } catch (err) {
    console.error('Audit failed:', err);
    res.status(500).json({ error: err.message, ok: false });
  }
}

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'page-audit',
    activeAudits: active,
    queued: queue.length,
    maxConcurrent: MAX_CONCURRENT,
  });
});

const auditPaths = ['/api/audit', '/audit'];

app.post(auditPaths, checkApiKey, (req, res) => {
  const { url, ...options } = req.body || {};
  return handleAudit(req, res, url, options);
});

// Convenience GET form: /api/audit?url=example.com
app.get(auditPaths, checkApiKey, (req, res) => {
  const { url, ...options } = req.query || {};
  return handleAudit(req, res, url, options);
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found. Try POST /api/audit or GET /health' });
});

// Express error handler (malformed JSON bodies, etc.)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal error' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`page-audit server listening on :${PORT}`);
  if (API_KEY) console.log('API key auth: enabled');
});

// Browser audits can legitimately take a couple of minutes.
server.requestTimeout = REQUEST_TIMEOUT_MS;
server.headersTimeout = REQUEST_TIMEOUT_MS + 5000;

function shutdown(signal) {
  console.log(`\nReceived ${signal}, shutting down...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => console.error('Unhandled rejection:', reason));
