import type { ParsedPage } from "@seo-auditor/parser";

export interface CrawledPage {
  url: string;
  status: number;
  responseTimeMs: number;
  headers: Record<string, string>;
  html: string;
  htmlSize: number;
  contentHash: string;
  https: boolean;
}

export interface CrawlOptions {
  maxPages?: number;
  maxDepth?: number;
}

export interface CrawledSitePage {
  crawled: CrawledPage;
  page: ParsedPage;
  depth: number;
  parentUrl: string | null;
}

export interface SiteCrawlResult {
  pages: CrawledSitePage[];
  skippedByRobots: string[];
  visitedCount: number;
}
