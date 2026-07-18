import type { AuditPlugin, Finding } from "@seo-auditor/plugins";

const MIN_LENGTH = 50;
const MAX_LENGTH = 160;

export const metaDescriptionPlugin: AuditPlugin = {
  name: "meta-description",
  version: "0.1.0",
  category: "technical",
  scope: "page",

  run(page): Finding[] {

    const findings: Finding[] = [];
    const description = page.description.trim();

    if (!description) {
      findings.push({
        pluginName: "meta-description",
        category: "technical",
        severity: "warning",
        message: "Missing meta description."
      });
      return findings;
    }

    if (description.length < MIN_LENGTH) {
      findings.push({
        pluginName: "meta-description",
        category: "technical",
        severity: "info",
        message: `Meta description is short (${description.length} chars, recommended ${MIN_LENGTH}-${MAX_LENGTH}).`,
        details: { length: description.length }
      });
    } else if (description.length > MAX_LENGTH) {
      findings.push({
        pluginName: "meta-description",
        category: "technical",
        severity: "info",
        message: `Meta description is long (${description.length} chars) and may be truncated in search results.`,
        details: { length: description.length }
      });
    }

    return findings;

  }
};
