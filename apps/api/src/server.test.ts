import { describe, expect, it, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { FastifyInstance } from "fastify";
import { Queue, Worker } from "bullmq";
import { PluginRegistry } from "@seo-auditor/plugins";
import { technicalPlugins } from "@seo-auditor/technical";
import { securityPlugins } from "@seo-auditor/security";
import { runSiteAudit } from "@seo-auditor/orchestration";
import { SqliteAuditRepository, SqliteSiteAuditRepository } from "@seo-auditor/database";
import { QUEUE_NAME, QUEUE_PREFIX, createConnection, type SiteAuditJobData } from "@seo-auditor/queue";
import { buildServer } from "./server.js";

const FIXTURE_PAGES: Record<string, string> = {
  "/": `
    <html lang="en">
    <head>
      <title>Fixture Page</title>
      <meta name="description" content="A short fixture page used for integration testing.">
      <link rel="canonical" href="/">
    </head>
    <body>
      <h1>Fixture Heading</h1>
      <a href="/about">about</a>
      <a href="mailto:test@example.com">mail</a>
    </body>
    </html>
  `,
  "/about": `
    <html lang="en">
    <head><title>About</title></head>
    <body><h1>About Us</h1></body>
    </html>
  `,
  "/js-heavy": `
    <html lang="en">
    <head><title></title></head>
    <body>
      <div id="app"></div>
      <script>
        document.title = "Rendered by JS";
        document.getElementById("app").innerHTML = "<h1>Injected by JavaScript</h1>";
      </script>
    </body>
    </html>
  `,
  "/no-alt": `
    <html lang="en">
    <head><title>No Alt Fixture</title></head>
    <body><img src="x.png"></body>
    </html>
  `
};

let fixtureServer: Server;
let fixtureUrl: string;
let app: FastifyInstance;
let repository: SqliteAuditRepository;
let siteRepository: SqliteSiteAuditRepository;
let queue: Queue<SiteAuditJobData>;

async function waitForTerminalState(id: string, timeoutMs = 15000): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await app.inject({ method: "GET", url: `/site-audits/${id}` });
    const body = res.json();
    if (body.status === "completed" || body.status === "failed") return body;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for site audit ${id} to reach a terminal state`);
}

async function waitForCompletion(id: string, timeoutMs = 15000): Promise<any> {
  const body = await waitForTerminalState(id, timeoutMs);
  if (body.status === "failed") throw new Error(`Job failed: ${body.error}`);
  return body;
}

beforeAll(async () => {
  fixtureServer = createServer((req, res) => {
    const path = (req.url || "/").split("?")[0];
    const body = FIXTURE_PAGES[path];

    if (!body) {
      res.writeHead(404);
      res.end("not found");
      return;
    }

    res.writeHead(200, { "content-type": "text/html" });
    res.end(body);
  });

  await new Promise<void>(resolve => fixtureServer.listen(0, resolve));
  const { port } = fixtureServer.address() as AddressInfo;
  fixtureUrl = `http://localhost:${port}`;
});

afterAll(() => {
  fixtureServer.close();
});

beforeEach(() => {
  repository = new SqliteAuditRepository(":memory:");
  siteRepository = new SqliteSiteAuditRepository(":memory:");
  queue = new Queue(QUEUE_NAME, { connection: createConnection(), prefix: QUEUE_PREFIX });
  app = buildServer(repository, siteRepository, queue);
});

afterEach(async () => {
  await app.close();
  await queue.close();
  repository.close();
  siteRepository.close();
});

describe("POST /audits", () => {

  it("runs the full pipeline against a target and returns a persisted report", async () => {

    const response = await app.inject({
      method: "POST",
      url: "/audits",
      payload: { url: fixtureUrl }
    });

    expect(response.statusCode).toBe(201);

    const report = response.json();

    expect(report.id).toBeTruthy();
    expect(report.target).toBe(fixtureUrl);
    expect(report.page.title).toBe("Fixture Page");
    expect(report.page.headingCount).toBe(1);
    expect(typeof report.score.overall).toBe("number");
    expect(Array.isArray(report.findings)).toBe(true);

    // mailto: link must not be counted — regression check for the link-classification fix.
    expect(report.page.internalLinkCount).toBe(1);

  });

  it("returns 400 for a missing url", async () => {
    const response = await app.inject({ method: "POST", url: "/audits", payload: {} });
    expect(response.statusCode).toBe(400);
  });

  it("is unaffected by rendering when renderJs is not set", async () => {

    const response = await app.inject({
      method: "POST",
      url: "/audits",
      payload: { url: `${fixtureUrl}/js-heavy` }
    });

    const report = response.json();

    expect(report.rendering).toBeUndefined();
    expect(report.findings.some((f: { category: string }) => f.category === "javascript")).toBe(false);

  });

  it("renders the page and surfaces JS-only content as findings when renderJs is true", async () => {

    const response = await app.inject({
      method: "POST",
      url: "/audits",
      payload: { url: `${fixtureUrl}/js-heavy`, renderJs: true }
    });

    expect(response.statusCode).toBe(201);

    const report = response.json();

    expect(report.rendering).toBeTruthy();
    expect(report.rendering.attempted).toBe(true);
    expect(report.rendering.succeeded).toBe(true);

    const jsFindings = report.findings.filter((f: { category: string }) => f.category === "javascript");
    expect(jsFindings.length).toBeGreaterThan(0);
    expect(jsFindings.some((f: { message: string }) => f.message.includes("Title"))).toBe(true);

    expect(typeof report.score.byCategory.javascript).toBe("number");

  }, 30000);

  it("runs a Lighthouse performance check when checkPerformance is true", async () => {

    const response = await app.inject({
      method: "POST",
      url: "/audits",
      payload: { url: fixtureUrl, checkPerformance: true }
    });

    expect(response.statusCode).toBe(201);

    const report = response.json();

    expect(report.performance).toBeTruthy();
    expect(report.performance.attempted).toBe(true);
    expect(report.performance.succeeded).toBe(true);
    expect(typeof report.performance.score).toBe("number");
    expect(typeof report.score.byCategory.performance).toBe("number");

  }, 60000);

  it("runs an axe accessibility check and surfaces violations when checkAccessibility is true", async () => {

    const response = await app.inject({
      method: "POST",
      url: "/audits",
      payload: { url: `${fixtureUrl}/no-alt`, checkAccessibility: true }
    });

    expect(response.statusCode).toBe(201);

    const report = response.json();

    expect(report.accessibility).toBeTruthy();
    expect(report.accessibility.attempted).toBe(true);
    expect(report.accessibility.succeeded).toBe(true);
    expect(report.accessibility.violationCount).toBeGreaterThan(0);

    const a11yFindings = report.findings.filter((f: { category: string }) => f.category === "accessibility");
    expect(a11yFindings.length).toBeGreaterThan(0);
    expect(typeof report.score.byCategory.accessibility).toBe("number");

  }, 30000);

});

describe("GET /audits/:id and GET /audits", () => {

  it("retrieves a persisted report by id and by target", async () => {

    const created = await app.inject({
      method: "POST",
      url: "/audits",
      payload: { url: fixtureUrl }
    });

    const { id, target } = created.json();

    const byId = await app.inject({ method: "GET", url: `/audits/${id}` });
    expect(byId.statusCode).toBe(200);
    expect(byId.json().id).toBe(id);

    const byTarget = await app.inject({ method: "GET", url: `/audits?target=${encodeURIComponent(target)}` });
    expect(byTarget.statusCode).toBe(200);
    expect(byTarget.json()).toHaveLength(1);

  });

  it("returns 404 for an unknown id", async () => {
    const response = await app.inject({ method: "GET", url: "/audits/nonexistent" });
    expect(response.statusCode).toBe(404);
  });

});

describe("POST /site-audits (async via job queue)", () => {

  let worker: Worker<SiteAuditJobData>;

  beforeEach(() => {

    const registry = new PluginRegistry();
    registry.registerAll([...technicalPlugins, ...securityPlugins]);

    worker = new Worker<SiteAuditJobData>(
      QUEUE_NAME,
      async job => {
        await runSiteAudit(job.data.url, registry, siteRepository, job.data.options, job.data.id);
      },
      { connection: createConnection(), prefix: QUEUE_PREFIX }
    );

  });

  afterEach(async () => {
    await worker.close();
  });

  it("enqueues immediately (202, queued) then completes once the worker processes it", async () => {

    const enqueueStart = Date.now();

    const response = await app.inject({
      method: "POST",
      url: "/site-audits",
      payload: { url: fixtureUrl, maxPages: 10 }
    });

    // The whole point of the queue: this responds fast, not after a full crawl.
    expect(Date.now() - enqueueStart).toBeLessThan(1000);
    expect(response.statusCode).toBe(202);

    const { id, status } = response.json();
    expect(id).toBeTruthy();
    expect(status).toBe("queued");

    const report = await waitForCompletion(id);

    expect(report.status).toBe("completed");
    expect(report.target).toBe(fixtureUrl);
    expect(report.pagesCrawled).toBe(2); // "/" and "/about"
    expect(report.pages).toHaveLength(2);
    expect(Array.isArray(report.siteFindings)).toBe(true);
    expect(typeof report.score.overall).toBe("number");

    // Regression check: the aggregate score must track the per-page scores,
    // not collapse as page count grows.
    const perPageScores = report.pages.map((p: { score: { overall: number } }) => p.score.overall);
    const minPerPageScore = Math.min(...perPageScores);
    expect(report.score.overall).toBeGreaterThanOrEqual(minPerPageScore - 5);

    const job = await queue.getJob(id);
    await job?.remove();

  });

  it("marks the job failed when the seed page is unreachable, instead of completing with a fake perfect score", async () => {

    // Closed local port — fails fast and deterministically (ECONNREFUSED),
    // no DNS involved. Regression check for a real bug found via review:
    // crawlSite swallows an unreachable seed into an empty page list, and
    // an empty list used to score every category 100 (nothing to
    // penalize) and persist as "completed" — an unreachable site reporting
    // a perfect score.
    const response = await app.inject({
      method: "POST",
      url: "/site-audits",
      payload: { url: "http://127.0.0.1:1/", maxPages: 5 }
    });

    expect(response.statusCode).toBe(202);
    const { id } = response.json();

    const result = await waitForTerminalState(id);

    expect(result.status).toBe("failed");
    expect(result.error).toBeTruthy();

    const job = await queue.getJob(id);
    await job?.remove();

  });

  it("returns 400 for a missing url", async () => {
    const response = await app.inject({ method: "POST", url: "/site-audits", payload: {} });
    expect(response.statusCode).toBe(400);
  });

  it("returns 404 for a truly unknown site-audit id", async () => {
    const response = await app.inject({ method: "GET", url: "/site-audits/nonexistent" });
    expect(response.statusCode).toBe(404);
  });

});
