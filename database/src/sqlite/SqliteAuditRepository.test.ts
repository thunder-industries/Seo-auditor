import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { SqliteAuditRepository } from "./SqliteAuditRepository.js";
import type { AuditReport } from "@seo-auditor/reports";

function makeReport(overrides: Partial<AuditReport> = {}): AuditReport {
  return {
    id: crypto.randomUUID(),
    target: "https://example.com",
    createdAt: new Date().toISOString(),
    crawl: {
      status: 200,
      responseTimeMs: 42,
      https: true,
      htmlSize: 100,
      contentHash: "abc",
      server: "nginx"
    },
    page: {
      title: "Example",
      description: "",
      language: "en",
      canonical: null,
      headingCount: 1,
      imageCount: 0,
      scriptCount: 0,
      stylesheetCount: 0,
      internalLinkCount: 0,
      externalLinkCount: 0,
      emails: [],
      phones: []
    },
    findings: [],
    score: { overall: 90, byCategory: { technical: 90, security: 90 } },
    ...overrides
  };
}

describe("SqliteAuditRepository", () => {

  let repo: SqliteAuditRepository;

  beforeEach(() => {
    repo = new SqliteAuditRepository(":memory:");
  });

  afterEach(() => {
    repo.close();
  });

  it("returns null for an id that was never saved", async () => {
    expect(await repo.getById("nonexistent")).toBeNull();
  });

  it("round-trips a saved report through getById", async () => {
    const report = makeReport();
    const id = await repo.save(report);

    expect(id).toBe(report.id);

    const fetched = await repo.getById(report.id);
    expect(fetched).toEqual(report);
  });

  it("lists audits for a target, most recent first", async () => {
    const older = makeReport({ target: "https://example.com", createdAt: "2026-01-01T00:00:00.000Z" });
    const newer = makeReport({ target: "https://example.com", createdAt: "2026-02-01T00:00:00.000Z" });
    const other = makeReport({ target: "https://other.com" });

    await repo.save(older);
    await repo.save(newer);
    await repo.save(other);

    const results = await repo.listByTarget("https://example.com");

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe(newer.id);
    expect(results[1].id).toBe(older.id);
  });

});
