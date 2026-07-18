import { randomUUID } from "node:crypto";
import { crawlSite, type CrawlOptions } from "@seo-auditor/crawler";
import { PluginRegistry } from "@seo-auditor/plugins";
import { computeScore, scoreCategory, combineCategoryScores, type ScoreResult } from "@seo-auditor/scoring";
import { buildReport, computeSiteFindings, type SiteAuditReport, type AuditReport } from "@seo-auditor/reports";
import type { Finding } from "@seo-auditor/plugins";
import type { SiteAuditRepository } from "@seo-auditor/database";
import { normalizeTarget } from "./runAudit.js";

const DEFAULT_MAX_PAGES = 25;

/**
 * Combines each page's own score with the site-wide findings into one
 * aggregate. Deliberately NOT "pool every finding from every page and
 * rescore" — that scales the penalty with page count while the ceiling
 * stays at 100, so a healthy multi-page site's score collapses toward 0 as
 * more pages are crawled (found via review: a 2-page site of identical
 * quality to a 1-page site scored ~15 points lower for no real reason).
 * Instead: average each category's per-page scores (how do pages look on
 * average), then apply the site-wide findings' own penalty on top, once —
 * since domain-level facts like "missing HSTS" are already recomputed on
 * every page, applying their penalty once per page would still overweight
 * them relative to how many times the underlying issue actually exists.
 */
export function aggregateScore(
  pageReports: AuditReport[],
  siteFindings: Finding[],
  registeredCategories: string[]
): ScoreResult {

  const byCategory: Record<string, number> = {};

  for (const category of registeredCategories) {

    const pageScores = pageReports.map(r => r.score.byCategory[category] ?? 100);
    const pageAverage = pageScores.length
      ? Math.round(pageScores.reduce((sum, s) => sum + s, 0) / pageScores.length)
      : 100;

    const siteFindingsForCategory = siteFindings.filter(f => f.category === category);
    const siteFindingsScore = scoreCategory(siteFindingsForCategory);

    // Both are "out of 100"; apply the site-wide deviation on top of the
    // per-page average deviation, once, rather than averaging the two
    // scores together (which would halve the real impact of a genuine
    // site-wide critical issue).
    byCategory[category] = Math.max(0, Math.min(100, pageAverage + siteFindingsScore - 100));

  }

  const overall = combineCategoryScores(byCategory, registeredCategories);

  return { overall, byCategory };

}

/**
 * The multi-page analog of runAudit: crawl -> per-page plugins -> site-level
 * findings -> score -> persist, as a single function. Phase 3's worker
 * (apps/worker/src/processor.ts) calls this exact function unchanged as a
 * BullMQ job handler, passing through the job's id so the persisted report's
 * id matches the id the client was already given when the job was enqueued.
 */
export async function runSiteAudit(
  url: string,
  registry: PluginRegistry,
  repository: SiteAuditRepository,
  options: CrawlOptions = {},
  id: string = randomUUID()
): Promise<SiteAuditReport> {

  const target = normalizeTarget(url);
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;

  const crawlResult = await crawlSite(target, { ...options, maxPages });

  if (crawlResult.pages.length === 0) {
    // crawlSite swallows per-page failures (a mid-crawl 404 shouldn't abort
    // the whole audit), but zero pages means nothing was actually audited —
    // silently persisting an empty report scores every category 100
    // (nothing to penalize), which reads as "perfect site" for a site that
    // was actually unreachable or entirely blocked by robots.txt. Fail the
    // job instead so that reads as failure, not success.
    const reason = crawlResult.skippedByRobots.length > 0
      ? "the seed page is disallowed by robots.txt"
      : "the seed page could not be reached";
    throw new Error(`Site audit failed: ${reason} (${target})`);
  }

  const allPlugins = registry.getAll();
  const registeredCategories = [...new Set(allPlugins.map(p => p.category))];

  // Domain-scoped plugins (DNS, robots.txt, TLS cert, security headers)
  // check a fact about the whole site, identical no matter which page asked
  // — run them once, against the seed page's context (guaranteed to be
  // crawlResult.pages[0] by BFS construction, and guaranteed to exist by
  // the zero-pages check above), instead of once per crawled page. Their
  // finding is still merged into every page's own findings list below so
  // each page's report shape is unchanged; this stays scoring-safe because
  // aggregateScore *averages* each page's score rather than summing, so N
  // identical pages carrying the same one-time penalty average back to
  // that same penalty, not N times it.
  const domainPlugins = allPlugins.filter(p => p.scope === "domain");
  const pagePlugins = allPlugins.filter(p => p.scope === "page");

  const domainRegistry = new PluginRegistry();
  domainRegistry.registerAll(domainPlugins);

  const seedPage = crawlResult.pages[0];
  const domainFindings = await domainRegistry.runAll(seedPage.page, {
    url: seedPage.crawled.url,
    crawled: seedPage.crawled
  });

  const pageRegistry = new PluginRegistry();
  pageRegistry.registerAll(pagePlugins);

  const pageReports = await Promise.all(
    crawlResult.pages.map(async sitePage => {
      const pageFindings = await pageRegistry.runAll(sitePage.page, {
        url: sitePage.crawled.url,
        crawled: sitePage.crawled
      });
      const findings = [...pageFindings, ...domainFindings];
      const score = computeScore(findings, registeredCategories);
      return buildReport(sitePage.crawled, sitePage.page, findings, score);
    })
  );

  const siteFindings = await computeSiteFindings(crawlResult.pages);

  const siteScore = aggregateScore(pageReports, siteFindings, registeredCategories);

  const report: SiteAuditReport = {
    id,
    target,
    createdAt: new Date().toISOString(),
    pagesCrawled: crawlResult.pages.length,
    maxPagesReached: crawlResult.pages.length >= maxPages,
    pages: pageReports,
    siteFindings,
    score: siteScore
  };

  await repository.save(report);

  return report;

}
