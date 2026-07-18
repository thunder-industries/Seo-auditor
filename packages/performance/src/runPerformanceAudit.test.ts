import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { runPerformanceAudit } from "./runPerformanceAudit.js";

let server: Server;
let fixtureUrl: string;

beforeAll(async () => {
  server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(`
      <html lang="en">
      <head><title>Fixture</title></head>
      <body><h1>Fixture Page</h1></body>
      </html>
    `);
  });
  await new Promise<void>(resolve => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  fixtureUrl = `http://localhost:${port}`;
});

afterAll(() => {
  server.close();
});

// Lighthouse runs in a spawned plain-node child process (see
// lighthouseChild.mjs for why) against a real Chromium instance. Given this
// session's earlier lesson about real-timing flakiness in this sandbox (the
// DNS concurrency/timeout saga in Phase 2), these assertions deliberately
// check structure and sanity bounds only — never a specific score value or
// tight metric range, since real Lighthouse timing varies run to run.
describe("runPerformanceAudit", () => {

  it("returns a sane score and metrics for a simple static page", async () => {

    const result = await runPerformanceAudit(fixtureUrl);

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);

    expect(result.metrics.lcpMs).toBeGreaterThanOrEqual(0);
    expect(result.metrics.cls).toBeGreaterThanOrEqual(0);
    expect(result.metrics.tbtMs).toBeGreaterThanOrEqual(0);
    expect(result.metrics.fcpMs).toBeGreaterThanOrEqual(0);
    expect(result.metrics.siMs).toBeGreaterThanOrEqual(0);

    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings.every(f => f.category === "performance")).toBe(true);

  }, 60000);

});
