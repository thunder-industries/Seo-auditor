import { crawlPage } from "@seo-auditor/crawler";
import { parseHtml } from "@seo-auditor/parser";
import { PluginRegistry } from "@seo-auditor/plugins";
import type { Finding } from "@seo-auditor/plugins";
import { computeScore } from "@seo-auditor/scoring";
import { buildReport, type AuditReport } from "@seo-auditor/reports";
import type { AuditRepository } from "@seo-auditor/database";
import { renderPage, compareRendering } from "@seo-auditor/javascript";
import { runPerformanceAudit } from "@seo-auditor/performance";
import { runAccessibilityAudit } from "@seo-auditor/accessibility";

export function normalizeTarget(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export interface AuditOptions {
  /**
   * Renders the page with a real browser and compares it against the raw
   * fetch, surfacing content/metadata only visible after JS runs. Off by
   * default — rendering adds real latency that most audits don't need:
   * ~1s against a static local fixture, but real sites with trackers or
   * polling can push `waitUntil: "networkidle"` (packages/javascript's
   * renderPage) up to its 20s navigation timeout, since that wait
   * condition is "500ms with no network activity," which busy real-world
   * pages may never hit quickly. See packages/javascript.
   */
  renderJs?: boolean;

  /**
   * Runs a Lighthouse performance audit (packages/performance). Off by
   * default — Lighthouse launches its own Chromium and takes several
   * seconds even for a trivial page. Fails soft, same pattern as renderJs.
   */
  checkPerformance?: boolean;

  /**
   * Runs an axe-core accessibility audit (packages/accessibility). Off by
   * default, same reasoning and fail-soft pattern as renderJs/checkPerformance.
   */
  checkAccessibility?: boolean;
}

/**
 * The full crawl -> parse -> plugins -> score -> persist pipeline for one
 * URL, as a single function. Called directly (synchronously) by apps/api's
 * POST /audits — it's already fast enough that Phase 3's job queue only
 * covers the slower multi-page runSiteAudit, not this.
 */
export async function runAudit(
  url: string,
  registry: PluginRegistry,
  repository: AuditRepository,
  options: AuditOptions = {}
): Promise<AuditReport> {

  const target = normalizeTarget(url);

  const crawled = await crawlPage(target);
  const page = parseHtml(target, crawled.html);

  const findings = await registry.runAll(page, { url: target, crawled });

  const registeredCategories = [...new Set(registry.getAll().map(p => p.category))];

  let renderingFindings: Finding[] = [];
  let rendering: AuditReport["rendering"];

  if (options.renderJs) {

    try {

      const rendered = await renderPage(target);
      const renderedPage = parseHtml(target, rendered.html);

      renderingFindings = compareRendering({
        rawPage: page,
        rawHtml: crawled.html,
        renderedPage,
        renderedHtml: rendered.html,
        consoleErrors: rendered.consoleErrors
      });

      rendering = {
        attempted: true,
        succeeded: true,
        consoleErrors: rendered.consoleErrors
      };

      // Only contributes a "javascript" scoring category when rendering
      // actually succeeded — gated here, not on options.renderJs alone, so
      // a failed/timed-out render doesn't get scored as a category with
      // zero findings (i.e. a perfect 100 for an assessment that never
      // actually ran). That would let a broken render *raise* the overall
      // score relative to not requesting rendering at all — found via
      // review, since category scores only have a floor for real findings,
      // never a penalty for "couldn't assess."
      registeredCategories.push("javascript");

    } catch (err) {

      // Fails soft — a broken/unavailable browser shouldn't sink the whole
      // audit, same pattern as DNS/SSL/geo elsewhere in this codebase.
      // Unlike those, on failure we deliberately do NOT add "javascript" to
      // registeredCategories above, so this category is simply absent from
      // score.byCategory rather than defaulting to 100.
      rendering = {
        attempted: true,
        succeeded: false,
        error: (err as Error).message
      };

    }

  }

  let performanceFindings: Finding[] = [];
  let performance: AuditReport["performance"];

  if (options.checkPerformance) {

    try {

      const result = await runPerformanceAudit(target);
      performanceFindings = result.findings;
      performance = { attempted: true, succeeded: true, score: result.score, metrics: result.metrics };

      // Same success-gated pattern as "javascript" above — see that
      // comment for why this must not be unconditional on options.checkPerformance.
      registeredCategories.push("performance");

    } catch (err) {

      performance = { attempted: true, succeeded: false, error: (err as Error).message };

    }

  }

  let accessibilityFindings: Finding[] = [];
  let accessibility: AuditReport["accessibility"];

  if (options.checkAccessibility) {

    try {

      const result = await runAccessibilityAudit(target);
      accessibilityFindings = result.findings;
      accessibility = { attempted: true, succeeded: true, violationCount: result.violationCount };

      // Same success-gated pattern as "javascript"/"performance" above.
      registeredCategories.push("accessibility");

    } catch (err) {

      accessibility = { attempted: true, succeeded: false, error: (err as Error).message };

    }

  }

  const allFindings = [...findings, ...renderingFindings, ...performanceFindings, ...accessibilityFindings];
  const score = computeScore(allFindings, registeredCategories);

  const report = buildReport(crawled, page, allFindings, score);

  if (rendering) report.rendering = rendering;
  if (performance) report.performance = performance;
  if (accessibility) report.accessibility = accessibility;

  await repository.save(report);

  return report;

}
