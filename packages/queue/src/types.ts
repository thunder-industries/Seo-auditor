import type { CrawlOptions } from "@seo-auditor/crawler";

export interface SiteAuditJobData {
  id: string;
  url: string;
  options: CrawlOptions;
}
