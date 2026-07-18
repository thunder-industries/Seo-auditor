import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { PluginRegistry } from "@seo-auditor/plugins";
import { technicalPlugins } from "@seo-auditor/technical";
import { securityPlugins } from "@seo-auditor/security";
import { SqliteAuditRepository } from "@seo-auditor/database";

// Regression test for a real scoring bug found via review: a failed render
// used to still push "javascript" into registeredCategories, so computeScore
// gave it 0 findings -> a perfect 100 for an assessment that never actually
// ran, which could only ever raise (never lower) the overall score relative
// to not requesting rendering at all. Forces renderPage to fail by pointing
// CHROMIUM_EXECUTABLE_PATH at a nonexistent binary before importing
// runAudit/renderPage, since that env var is read once at module load.
vi.stubEnv("CHROMIUM_EXECUTABLE_PATH", "/nonexistent/chromium-binary");

const { runAudit } = await import("./runAudit.js");

let fixtureServer: Server;
let fixtureUrl: string;

beforeAll(async () => {
  fixtureServer = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(`
      <html lang="en">
      <head>
        <title>Fixture Page</title>
        <meta name="description" content="A fixture page for runAudit tests.">
      </head>
      <body><h1>Heading</h1></body>
      </html>
    `);
  });
  await new Promise<void>(resolve => fixtureServer.listen(0, resolve));
  const { port } = fixtureServer.address() as AddressInfo;
  fixtureUrl = `http://localhost:${port}`;
});

afterAll(() => {
  fixtureServer.close();
});

describe("runAudit — failed rendering must not affect scoring", () => {

  it("does not add a javascript category or change the score when rendering fails", async () => {

    const registry = new PluginRegistry();
    registry.registerAll([...technicalPlugins, ...securityPlugins]);

    const withoutRendering = new SqliteAuditRepository(":memory:");
    const withRendering = new SqliteAuditRepository(":memory:");

    try {

      const baseline = await runAudit(fixtureUrl, registry, withoutRendering, {});
      const attempted = await runAudit(fixtureUrl, registry, withRendering, { renderJs: true });

      expect(attempted.rendering).toBeTruthy();
      expect(attempted.rendering?.attempted).toBe(true);
      expect(attempted.rendering?.succeeded).toBe(false);

      // The core assertion: a failed render must not appear as a scored
      // category, and must not change the score versus not rendering at all.
      expect(attempted.score.byCategory.javascript).toBeUndefined();
      expect(attempted.score.byCategory).toEqual(baseline.score.byCategory);
      expect(attempted.score.overall).toBe(baseline.score.overall);

    } finally {
      withoutRendering.close();
      withRendering.close();
    }

  }, 20000);

  it("does not add a performance category or change the score when the Lighthouse check fails", async () => {

    const registry = new PluginRegistry();
    registry.registerAll([...technicalPlugins, ...securityPlugins]);

    const withoutCheck = new SqliteAuditRepository(":memory:");
    const withCheck = new SqliteAuditRepository(":memory:");

    try {

      const baseline = await runAudit(fixtureUrl, registry, withoutCheck, {});
      const attempted = await runAudit(fixtureUrl, registry, withCheck, { checkPerformance: true });

      expect(attempted.performance).toBeTruthy();
      expect(attempted.performance?.attempted).toBe(true);
      expect(attempted.performance?.succeeded).toBe(false);

      expect(attempted.score.byCategory.performance).toBeUndefined();
      expect(attempted.score.byCategory).toEqual(baseline.score.byCategory);
      expect(attempted.score.overall).toBe(baseline.score.overall);

    } finally {
      withoutCheck.close();
      withCheck.close();
    }

  }, 30000);

  it("does not add an accessibility category or change the score when the axe check fails", async () => {

    const registry = new PluginRegistry();
    registry.registerAll([...technicalPlugins, ...securityPlugins]);

    const withoutCheck = new SqliteAuditRepository(":memory:");
    const withCheck = new SqliteAuditRepository(":memory:");

    try {

      const baseline = await runAudit(fixtureUrl, registry, withoutCheck, {});
      const attempted = await runAudit(fixtureUrl, registry, withCheck, { checkAccessibility: true });

      expect(attempted.accessibility).toBeTruthy();
      expect(attempted.accessibility?.attempted).toBe(true);
      expect(attempted.accessibility?.succeeded).toBe(false);

      expect(attempted.score.byCategory.accessibility).toBeUndefined();
      expect(attempted.score.byCategory).toEqual(baseline.score.byCategory);
      expect(attempted.score.overall).toBe(baseline.score.overall);

    } finally {
      withoutCheck.close();
      withCheck.close();
    }

  }, 20000);

});
