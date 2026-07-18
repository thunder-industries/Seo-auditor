#!/usr/bin/env node
// Plain Node ESM, deliberately NOT TypeScript — this must run under a bare
// `node` process, never through an esbuild-based loader (tsx, vitest).
// Lighthouse serializes its own gatherer functions and ships them into the
// browser page over CDP; esbuild's `__name(...)` name-preserving wrapper
// survives that serialization, but the browser page context has no
// `__name` defined, so any esbuild-transformed Lighthouse source throws
// "ReferenceError: __name is not defined" mid-audit. Confirmed with a
// side-by-side test: identical code succeeds under `node`, fails under
// `tsx`. Being plain JS also means this file can't import the TS
// launchChromium helper (packages/browser/src/launchChromium.ts) — plain
// node can't resolve .ts specifiers — hence the small duplication below.
import { chromium } from "playwright-core";
import lighthouse from "lighthouse";
import { createServer } from "node:net";

const EXECUTABLE_PATH = process.env.CHROMIUM_EXECUTABLE_PATH ?? "/usr/bin/chromium";

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function main() {
  const url = process.argv[2];
  if (!url) throw new Error("Usage: node lighthouseChild.mjs <url>");

  const port = await getFreePort();
  const browser = await chromium.launch({
    executablePath: EXECUTABLE_PATH,
    headless: true,
    args: ["--no-sandbox", `--remote-debugging-port=${port}`]
  });

  try {

    const runnerResult = await lighthouse(url, {
      port,
      output: "json",
      onlyCategories: ["performance"],
      logLevel: "error"
    });

    if (!runnerResult) throw new Error("Lighthouse returned no result.");

    const { lhr } = runnerResult;

    const score = Math.round((lhr.categories.performance?.score ?? 0) * 100);
    const metrics = {
      lcpMs: lhr.audits["largest-contentful-paint"]?.numericValue ?? 0,
      cls: lhr.audits["cumulative-layout-shift"]?.numericValue ?? 0,
      tbtMs: lhr.audits["total-blocking-time"]?.numericValue ?? 0,
      fcpMs: lhr.audits["first-contentful-paint"]?.numericValue ?? 0,
      siMs: lhr.audits["speed-index"]?.numericValue ?? 0
    };

    // The ONLY thing written to stdout — the parent process parses this as
    // JSON, so nothing else may go there. Lighthouse's own logger and any
    // Chromium output go to stderr.
    process.stdout.write(JSON.stringify({ score, metrics }));

  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
