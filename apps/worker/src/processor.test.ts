import { describe, expect, it, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import { Queue, type Job } from "bullmq";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { QUEUE_NAME, QUEUE_PREFIX, createConnection, type SiteAuditJobData } from "@seo-auditor/queue";
import { SqliteSiteAuditRepository } from "@seo-auditor/database";
import { createProcessor } from "./processor.js";

const FIXTURE_HTML = `<html><head><title>Worker Fixture</title></head><body><h1>Hi</h1></body></html>`;

let fixtureServer: Server;
let fixtureUrl: string;
let queue: Queue<SiteAuditJobData>;
let repository: SqliteSiteAuditRepository;

beforeAll(async () => {

  fixtureServer = createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(FIXTURE_HTML);
  });

  await new Promise<void>(resolve => fixtureServer.listen(0, resolve));
  const { port } = fixtureServer.address() as AddressInfo;
  fixtureUrl = `http://localhost:${port}`;

  queue = new Queue(QUEUE_NAME, { connection: createConnection(), prefix: QUEUE_PREFIX });

});

afterAll(async () => {
  fixtureServer.close();
  await queue.close();
});

beforeEach(() => {
  repository = new SqliteSiteAuditRepository(":memory:");
});

afterEach(() => {
  repository.close();
});

describe("processSiteAuditJob", () => {

  it("crawls the target and persists a SiteAuditReport under the job's id", async () => {

    const id = randomUUID();

    const job = await queue.add(
      "site-audit",
      { id, url: fixtureUrl, options: {} },
      { jobId: id }
    ) as Job<SiteAuditJobData>;

    const processor = createProcessor(repository);
    await processor(job);

    const saved = await repository.getById(id);

    expect(saved).toBeTruthy();
    expect(saved!.id).toBe(id);
    expect(saved!.target.startsWith(fixtureUrl)).toBe(true);
    expect(saved!.pagesCrawled).toBe(1);
    expect(saved!.pages[0].page.title).toBe("Worker Fixture");

    await job.remove();

  });

});
