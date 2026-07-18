import type { AuditPlugin, Finding } from "@seo-auditor/plugins";

export const headingStructurePlugin: AuditPlugin = {
  name: "heading-structure",
  version: "0.1.0",
  category: "technical",
  scope: "page",

  run(page): Finding[] {

    const findings: Finding[] = [];

    if (page.headings.length === 0) {
      findings.push({
        pluginName: "heading-structure",
        category: "technical",
        severity: "warning",
        message: "No H1 heading found on the page."
      });
    } else if (page.headings.length > 1) {
      findings.push({
        pluginName: "heading-structure",
        category: "technical",
        severity: "warning",
        message: `Multiple H1 headings found (${page.headings.length}); pages should have exactly one.`,
        details: { headings: page.headings }
      });
    }

    const emptyHeadings = page.headings.filter(h => h.length === 0);
    if (emptyHeadings.length > 0) {
      findings.push({
        pluginName: "heading-structure",
        category: "technical",
        severity: "info",
        message: `${emptyHeadings.length} empty H1 heading(s) found.`
      });
    }

    return findings;

  }
};
