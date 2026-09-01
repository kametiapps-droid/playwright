#!/usr/bin/env node
import { runAudit } from './auditor.js';
import { writeFile } from 'node:fs/promises';

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out' || a === '-o') {
      args.out = argv[++i];
    } else if (a === '--headed') {
      args.headless = false;
    } else if (a === '--no-humanize') {
      args.humanize = false;
    } else if (a === '--timeout') {
      args.navTimeout = parseInt(argv[++i], 10);
    } else if (a === '--skip-robots') {
      args.skipRobots = true;
    } else if (a === '--skip-sitemap') {
      args.skipSitemap = true;
    } else if (a === '--help' || a === '-h') {
      args.help = true;
    } else {
      args._.push(a);
    }
  }
  return args;
}

function printHelp() {
  console.log(`page-audit — full-site audit (links, images, robots.txt, sitemap, security headers)

Usage:
  node audit.js <url> [options]

Options:
  --out, -o <file>     Write JSON report to a file instead of stdout
  --headed             Run with a visible browser window (debugging)
  --no-humanize         Disable Camoufox's human-like cursor/typing behavior
  --timeout <ms>        Navigation timeout in ms (default 30000)
  --skip-robots         Don't audit robots.txt
  --skip-sitemap        Don't audit sitemap.xml
  --help, -h             Show this help

Example:
  node audit.js example.com
  node audit.js https://example.com --out report.json
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args._.length === 0) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const target = args._[0];
  const report = await runAudit(target, {
    navTimeout: args.navTimeout,
    headless: args.headless,
    humanize: args.humanize,
    skipRobots: args.skipRobots,
    skipSitemap: args.skipSitemap,
  });

  const json = JSON.stringify(report, null, 2);

  if (args.out) {
    await writeFile(args.out, json, 'utf8');
    console.log(`Report written to ${args.out}`);
  } else {
    console.log(json);
  }

  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
