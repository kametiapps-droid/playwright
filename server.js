import express from 'express';
import { runAudit } from './auditor.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const API_KEY = process.env.API_KEY || null;
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_AUDITS || '3', 10);

const app = express();
app.use(express.json());

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

app.get('/health', (req, res) => {
  res.json({ status: 'ok', activeAudits: active, queued: queue.length });
});

app.post('/api/audit', checkApiKey, async (req, res) => {
  const { url, ...options } = req.body || {};

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: '"url" (string) is required in the JSON body' });
  }

  try {
    const report = await runQueued(() => runAudit(url, options));
    res.status(report.ok ? 200 : 502).json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Convenience GET form: /api/audit?url=example.com
app.get('/api/audit', checkApiKey, async (req, res) => {
  const { url, ...options } = req.query || {};

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: '"url" query param is required' });
  }

  try {
    const report = await runQueued(() => runAudit(url, options));
    res.status(report.ok ? 200 : 502).json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found. Try POST /api/audit or GET /health' });
});

const server = app.listen(PORT, () => {
  console.log(`page-audit server listening on :${PORT}`);
  if (API_KEY) console.log('API key auth: enabled');
});

function shutdown(signal) {
  console.log(`\nReceived ${signal}, shutting down...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
