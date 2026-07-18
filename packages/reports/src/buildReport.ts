import { randomUUID } from "node:crypto";
import type { CrawledPage } from "@seo-auditor/crawler";
import type { ParsedPage } from "@seo-auditor/parser";
import type { Finding } from "@seo-auditor/plugins";
import type { ScoreResult } from "@seo-auditor/scoring";
import type { AuditReport } from "./types.js";

export function buildReport(
  crawled: CrawledPage,
  page: ParsedPage,
  findings: Finding[],
  score: ScoreResult
): AuditReport {

  return {
    id: randomUUID(),
    target: crawled.url,
    createdAt: new Date().toISOString(),
    crawl: {
      status: crawled.status,
      responseTimeMs: crawled.responseTimeMs,
      https: crawled.https,
      htmlSize: crawled.htmlSize,
      contentHash: crawled.contentHash,
      server: crawled.headers.server ?? null
    },
    page: {
      title: page.title,
      description: page.description,
      language: page.language,
      canonical: page.canonical,
      headingCount: page.headings.length,
      imageCount: page.images.length,
      scriptCount: page.scripts.length,
      stylesheetCount: page.stylesheets.length,
      internalLinkCount: page.internalLinks.length,
      externalLinkCount: page.externalLinks.length,
      emails: page.emails,
      phones: page.phones
    },
    findings,
    score
  };

}
