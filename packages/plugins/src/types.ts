import type { CrawledPage } from "@seo-auditor/crawler";
import type { ParsedPage } from "@seo-auditor/parser";

export type Severity = "critical" | "warning" | "info";

export interface Finding {
  pluginName: string;
  category: string;
  severity: Severity;
  message: string;
  details?: Record<string, unknown>;
}

export interface AuditContext {
  url: string;
  crawled: CrawledPage;
}

/**
 * "page" plugins depend on the specific page's content (title, headings).
 * "domain" plugins check a fact about the whole site (DNS, robots.txt,
 * TLS cert, security headers) that's identical no matter which page asked —
 * runSiteAudit (packages/orchestration) uses this to run domain-scoped
 * plugins once per site instead of once per crawled page.
 */
export type PluginScope = "page" | "domain";

/**
 * The contract every audit check implements. Phase 1 registers plugins
 * explicitly (see registry.ts) — the interface is written so a future
 * filesystem auto-loader can populate the same registry without any
 * plugin needing to change.
 */
export interface AuditPlugin {
  name: string;
  version: string;
  category: string;
  scope: PluginScope;
  run(page: ParsedPage, context: AuditContext): Promise<Finding[]> | Finding[];
}
