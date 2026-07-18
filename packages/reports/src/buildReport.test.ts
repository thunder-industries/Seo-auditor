import { describe, expect, it } from "vitest";
import { buildReport } from "./buildReport.js";
import type { CrawledPage } from "@seo-auditor/crawler";
import type { ParsedPage } from "@seo-auditor/parser";

const crawled: CrawledPage = {
  url: "https://example.com",
  status: 200,
  responseTimeMs: 50,
  headers: { server: "nginx" },
  html: "<html></html>",
  htmlSize: 13,
  contentHash: "abc123",
  https: true
};

const page: ParsedPage = {
  url: "https://example.com",
  title: "Example",
  description: "",
  language: "en",
  canonical: null,
  metaGenerator: null,
  headings: ["H1"],
  images: [],
  scripts: [],
  stylesheets: [],
  links: [],
  internalLinks: [],
  externalLinks: [],
  emails: [],
  phones: []
};

describe("buildReport", () => {

  it("assembles crawl, page, findings, and score into one report with a generated id", () => {
    const report = buildReport(crawled, page, [], { overall: 100, byCategory: {} });

    expect(report.id).toBeTruthy();
    expect(report.target).toBe("https://example.com");
    expect(report.crawl.server).toBe("nginx");
    expect(report.page.title).toBe("Example");
    expect(report.page.headingCount).toBe(1);
    expect(report.score.overall).toBe(100);
  });

});
