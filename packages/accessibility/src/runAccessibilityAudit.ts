import { AxeBuilder } from "@axe-core/playwright";
import { launchChromium } from "@seo-auditor/browser";
import type { Finding, Severity } from "@seo-auditor/plugins";

const NAVIGATION_TIMEOUT_MS = 20000;

// axe's own impact scale (minor/moderate/serious/critical/null) maps onto
// this project's three-level severity: critical/serious are real defects
// (critical), moderate is worth fixing but not urgent (warning), and
// minor/null are informational (info).
function toSeverity(impact: string | null | undefined): Severity {
  if (impact === "critical" || impact === "serious") return "critical";
  if (impact === "moderate") return "warning";
  return "info";
}

export interface AccessibilityResult {
  violationCount: number;
  findings: Finding[];
}

/** Runs an axe-core accessibility audit against a real, rendered page. */
export async function runAccessibilityAudit(url: string): Promise<AccessibilityResult> {

  const browser = await launchChromium();

  try {

    // @axe-core/playwright requires a page from an explicit browser context
    // (not the implicit one browser.newPage() creates) — see
    // https://github.com/dequelabs/axe-core-npm/blob/develop/packages/playwright/error-handling.md
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: NAVIGATION_TIMEOUT_MS });

    const results = await new AxeBuilder({ page }).analyze();

    const findings: Finding[] = results.violations.map(violation => ({
      pluginName: "axe-accessibility",
      category: "accessibility",
      severity: toSeverity(violation.impact),
      message: `${violation.help} (${violation.nodes.length} element(s) affected)`,
      details: { ruleId: violation.id, helpUrl: violation.helpUrl }
    }));

    return { violationCount: results.violations.length, findings };

  } finally {

    await browser.close();

  }

}
