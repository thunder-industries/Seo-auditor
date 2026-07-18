import type { AuditPlugin, Finding } from "@seo-auditor/plugins";

const MIN_LENGTH = 30;
const MAX_LENGTH = 60;

export const titleTagPlugin: AuditPlugin = {
  name: "title-tag",
  version: "0.1.0",
  category: "technical",
  scope: "page",

  run(page): Finding[] {

    const findings: Finding[] = [];
    const title = page.title.trim();

    if (!title) {
      findings.push({
        pluginName: "title-tag",
        category: "technical",
        severity: "critical",
        message: "Missing <title> tag."
      });
      return findings;
    }

    if (title.length < MIN_LENGTH) {
      findings.push({
        pluginName: "title-tag",
        category: "technical",
        severity: "info",
        message: `Title is short (${title.length} chars, recommended ${MIN_LENGTH}-${MAX_LENGTH}).`,
        details: { length: title.length }
      });
    } else if (title.length > MAX_LENGTH) {
      findings.push({
        pluginName: "title-tag",
        category: "technical",
        severity: "warning",
        message: `Title is long (${title.length} chars) and may be truncated in search results.`,
        details: { length: title.length }
      });
    }

    return findings;

  }
};
