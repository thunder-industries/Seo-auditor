import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { SqliteSiteAuditRepository } from "./SqliteSiteAuditRepository.js";
import type { SiteAuditReport } from "@seo-auditor/reports";

function makeSiteReport(overrides: Partial<SiteAuditReport> = {}): SiteAuditReport {
  return {
    id: crypto.randomUUID(),
    target: "https://example.com",
    createdAt: new Date().toISOString(),
    pagesCrawled: 1,
    maxPagesReached: false,
    pages: [],
    siteFindings: [],
    score: { overall: 90, byCategory: { technical: 90, security: 90 } },
    ...overrides
  };
}

describe("SqliteSiteAuditRepository", () => {

  let repo: SqliteSiteAuditRepository;

  beforeEach(() => {
    repo = new SqliteSiteAuditRepository(":memory:");
  });

  afterEach(() => {
    repo.close();
  });

  it("returns null for an id that was never saved", async () => {
    expect(await repo.getById("nonexistent")).toBeNull();
  });

  it("round-trips a saved site report through getById", async () => {
    const report = makeSiteReport();
    const id = await repo.save(report);

    expect(id).toBe(report.id);

    const fetched = await repo.getById(report.id);
    expect(fetched).toEqual(report);
  });

  it("lists site audits for a target, most recent first", async () => {
    const older = makeSiteReport({ target: "https://example.com", createdAt: "2026-01-01T00:00:00.000Z" });
    const newer = makeSiteReport({ target: "https://example.com", createdAt: "2026-02-01T00:00:00.000Z" });
    const other = makeSiteReport({ target: "https://other.com" });

    await repo.save(older);
    await repo.save(newer);
    await repo.save(other);

    const results = await repo.listByTarget("https://example.com");

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe(newer.id);
    expect(results[1].id).toBe(older.id);
  });

});
