/**
 * Category weights for the overall score. Only categories with at least one
 * registered plugin (and therefore possible findings) contribute — the
 * averaging code in scoreEngine.ts normalizes over whichever categories are
 * actually present, so adding a new category later (e.g. "performance") is
 * just a new row here, no changes to the averaging logic.
 */
export const CATEGORY_WEIGHTS: Record<string, number> = {
  technical: 0.5,
  security: 0.5,
  javascript: 0.3,
  performance: 0.4,
  accessibility: 0.3
};

/**
 * "info" carries no penalty: plugins emit info-level findings both for
 * genuine minor notes and for routine "here's what I found" results (e.g.
 * "resolved N DNS records", "certificate valid for N more days") that
 * aren't defects. Only critical/warning findings represent an actual
 * problem worth deducting points for.
 */
export const SEVERITY_PENALTY: Record<"critical" | "warning" | "info", number> = {
  critical: 25,
  warning: 10,
  info: 0
};
