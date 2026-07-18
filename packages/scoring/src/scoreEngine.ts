import type { Finding } from "@seo-auditor/plugins";
import { CATEGORY_WEIGHTS, SEVERITY_PENALTY } from "./weights.js";

export interface ScoreResult {
  overall: number;
  byCategory: Record<string, number>;
}

/** 100 minus a fixed penalty per finding by severity, clamped to [0,100]. */
export function scoreCategory(findings: Finding[]): number {
  const penalty = findings.reduce((sum, f) => sum + SEVERITY_PENALTY[f.severity], 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

/**
 * Weighted average of already-computed per-category scores, over whichever
 * categories actually have registered plugins (excluded categories don't
 * count as a perfect 100 — they're just not part of the average).
 */
export function combineCategoryScores(
  byCategory: Record<string, number>,
  registeredCategories: string[]
): number {

  let weightedSum = 0;
  let totalWeight = 0;

  for (const category of registeredCategories) {
    const weight = CATEGORY_WEIGHTS[category] ?? 0;
    weightedSum += (byCategory[category] ?? 100) * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

}

/**
 * Groups findings by category, scores each category, then combines them
 * into an overall score. Intended for a single page's findings — pooling
 * findings from multiple pages here is a bug (see runSiteAudit): the
 * penalty scales with page count while the ceiling stays at 100, so scores
 * collapse toward 0 as a site grows. Multi-page aggregation instead
 * averages each page's own score and applies site-wide findings once —
 * see apps/api/src/siteOrchestrator.ts.
 */
export function computeScore(
  findings: Finding[],
  registeredCategories: string[]
): ScoreResult {

  const byCategory: Record<string, number> = {};

  for (const category of registeredCategories) {
    const categoryFindings = findings.filter(f => f.category === category);
    byCategory[category] = scoreCategory(categoryFindings);
  }

  const overall = combineCategoryScores(byCategory, registeredCategories);

  return { overall, byCategory };

}
