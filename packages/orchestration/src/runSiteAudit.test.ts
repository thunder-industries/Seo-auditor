import { describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { aggregateScore, runSiteAudit } from "./runSiteAudit.js";
import { PluginRegistry } from "@seo-auditor/plugins";
import { SqliteSiteAuditRepository } from "@seo-auditor/database";
import type { AuditReport } from "@seo-auditor/reports";
import type { AuditPlugin, Finding } from "@seo-auditor/plugins";

function makePageReport(byCategoryOverrides: Record<string, number> = {}): AuditReport {
  return {
    id: "x",
    target: "https://example.com/",
    createdAt: new Date().toISOString(),
    crawl: { status: 200, responseTimeMs: 1, https: true, htmlSize: 1, contentHash: "x", server: null },
    page: {
      title: "x", description: "x", language: "en", canonical: null,
      headingCount: 1, imageCount: 0, scriptCount: 0, stylesheetCount: 0,
      internalLinkCount: 0, externalLinkCount: 0, emails: [], phones: []
    },
    findings: [],
    score: { overall: 90, byCategory: { technical: 90, security: 90, ...byCategoryOverrides } }
  };
}

describe("aggregateScore", () => {

  it("scores a single page the same as that page's own score", () => {
    const page = makePageReport();
    const result = aggregateScore([page], [], ["technical", "security"]);

    expect(result.byCategory.technical).toBe(90);
    expect(result.byCategory.security).toBe(90);
  });

  it("does not collapse the score as identical-quality pages are added — the core bug this fixes", () => {

    const onePage = aggregateScore([makePageReport()], [], ["technical", "security"]);
    const twoPages = aggregateScore([makePageReport(), makePageReport()], [], ["technical", "security"]);
    const fivePages = aggregateScore(
      [makePageReport(), makePageReport(), makePageReport(), makePageReport(), makePageReport()],
      [],
      ["technical", "security"]
    );

    expect(onePage.overall).toBe(90);
    expect(twoPages.overall).toBe(90);
    expect(fivePages.overall).toBe(90);

  });

  it("averages per-page scores when pages differ in quality", () => {
    const good = makePageReport({ technical: 100, security: 100 });
    const bad = makePageReport({ technical: 50, security: 50 });

    const result = aggregateScore([good, bad], [], ["technical", "security"]);

    expect(result.byCategory.technical).toBe(75);
    expect(result.byCategory.security).toBe(75);
  });

  it("applies site-wide findings' penalty once, not once per page", () => {

    const siteFindings: Finding[] = [
      { pluginName: "site-duplicate-title", category: "technical", severity: "warning", message: "x" }
    ];

    const result = aggregateScore(
      [makePageReport(), makePageReport(), makePageReport()],
      siteFindings,
      ["technical", "security"]
    );

    // 90 (page average) + (100 - 10 warning penalty) - 100 = 80, regardless of page count.
    expect(result.byCategory.technical).toBe(80);
    expect(result.byCategory.security).toBe(90);
  });

  it("clamps the combined score to [0, 100]", () => {
    const worst = makePageReport({ technical: 0, security: 0 });
    const criticalSiteFindings: Finding[] = [
      { pluginName: "x", category: "technical", severity: "critical", message: "x" }
    ];

    const result = aggregateScore([worst], criticalSiteFindings, ["technical", "security"]);

    expect(result.byCategory.technical).toBe(0);
    expect(result.byCategory.security).toBe(0);
    expect(result.overall).toBe(0);
  });

});

describe("runSiteAudit", () => {

  it("throws instead of persisting a fake perfect-score report when the seed is unreachable", async () => {

    const registry = new PluginRegistry();
    const repository = new SqliteSiteAuditRepository(":memory:");

    try {

      // Closed local port — fails fast and deterministically, no DNS involved.
      await expect(
        runSiteAudit("http://127.0.0.1:1/", registry, repository)
      ).rejects.toThrow(/could not be reached/);

      // The bug this guards against: nothing should have been persisted.
      const results = await repository.listByTarget("http://127.0.0.1:1/");
      expect(results).toHaveLength(0);

    } finally {
      repository.close();
    }

  });

  it("runs a domain-scoped plugin exactly once per site (not once per page), while still surfacing its finding on every page", async () => {

    const server = createServer((req, res) => {
      const path = (req.url || "/").split("?")[0];

      const pages: Record<string, string> = {
        "/": `<html><head><title>Home</title></head><body><a href="/a">a</a><a href="/b">b</a></body></html>`,
        "/a": `<html><head><title>A</title></head><body></body></html>`,
        "/b": `<html><head><title>B</title></head><body></body></html>`
      };

      const body = pages[path];

      if (!body) {
        res.writeHead(404);
        res.end("not found");
        return;
      }

      res.writeHead(200, { "content-type": "text/html" });
      res.end(body);
    });

    await new Promise<void>(resolve => server.listen(0, resolve));

    try {

      const { port } = server.address() as AddressInfo;
      const baseUrl = `http://localhost:${port}`;

      let domainCalls = 0;
      let pageCalls = 0;

      const domainSpyPlugin: AuditPlugin = {
        name: "domain-spy",
        version: "0.1.0",
        category: "technical",
        scope: "domain",
        run: () => {
          domainCalls++;
          return [{ pluginName: "domain-spy", category: "technical", severity: "info", message: "domain fact" }];
        }
      };

      const pageSpyPlugin: AuditPlugin = {
        name: "page-spy",
        version: "0.1.0",
        category: "technical",
        scope: "page",
        run: () => {
          pageCalls++;
          return [];
        }
      };

      const registry = new PluginRegistry();
      registry.registerAll([domainSpyPlugin, pageSpyPlugin]);

      const repository = new SqliteSiteAuditRepository(":memory:");

      try {

        const report = await runSiteAudit(baseUrl, registry, repository, { maxPages: 10 });

        expect(report.pagesCrawled).toBe(3); // "/", "/a", "/b"
        expect(domainCalls).toBe(1);
        expect(pageCalls).toBe(3);

        // Every page's own report still shows the domain-level finding.
        for (const pageReport of report.pages) {
          expect(pageReport.findings.some(f => f.pluginName === "domain-spy")).toBe(true);
        }

      } finally {
        repository.close();
      }

    } finally {
      server.close();
    }

  });

});

// The rest of runSiteAudit's pipeline (id passthrough, crawl -> plugins ->
// persist for a reachable target) is exercised end-to-end in apps/api's and
// apps/worker's integration tests, which need a real crawl target.
