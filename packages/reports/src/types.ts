import type { Finding } from "@seo-auditor/plugins";
import type { ScoreResult } from "@seo-auditor/scoring";

export interface AuditReport {
  id: string;
  target: string;
  createdAt: string;
  crawl: {
    status: number;
    responseTimeMs: number;
    https: boolean;
    htmlSize: number;
    contentHash: string;
    server: string | null;
  };
  page: {
    title: string;
    description: string;
    language: string;
    canonical: string | null;
    headingCount: number;
    imageCount: number;
    scriptCount: number;
    stylesheetCount: number;
    internalLinkCount: number;
    externalLinkCount: number;
    emails: string[];
    phones: string[];
  };
  findings: Finding[];
  score: ScoreResult;
  rendering?: {
    attempted: boolean;
    succeeded: boolean;
    consoleErrors?: string[];
    error?: string;
  };
  performance?: {
    attempted: boolean;
    succeeded: boolean;
    score?: number;
    metrics?: {
      lcpMs: number;
      cls: number;
      tbtMs: number;
      fcpMs: number;
      siMs: number;
    };
    error?: string;
  };
  accessibility?: {
    attempted: boolean;
    succeeded: boolean;
    violationCount?: number;
    error?: string;
  };
}

export interface SiteAuditReport {
  id: string;
  target: string;
  createdAt: string;
  pagesCrawled: number;
  maxPagesReached: boolean;
  pages: AuditReport[];
  siteFindings: Finding[];
  score: ScoreResult;
}
