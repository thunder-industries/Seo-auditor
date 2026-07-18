import type { AuditPlugin, Finding } from "@seo-auditor/plugins";

export const canonicalPlugin: AuditPlugin = {
  name: "canonical-tag",
  version: "0.1.0",
  category: "technical",
  scope: "page",

  run(page): Finding[] {

    if (!page.canonical) {
      return [{
        pluginName: "canonical-tag",
        category: "technical",
        severity: "info",
        message: "No canonical tag found."
      }];
    }

    try {
      const canonicalUrl = new URL(page.canonical, page.url);
      const pageUrl = new URL(page.url);

      if (canonicalUrl.href.replace(/\/$/, "") !== pageUrl.href.replace(/\/$/, "")) {
        return [{
          pluginName: "canonical-tag",
          category: "technical",
          severity: "info",
          message: `Canonical points to a different URL: ${canonicalUrl.href}`,
          details: { canonical: canonicalUrl.href, page: pageUrl.href }
        }];
      }
    } catch {
      return [{
        pluginName: "canonical-tag",
        category: "technical",
        severity: "warning",
        message: `Canonical tag has an invalid URL: ${page.canonical}`
      }];
    }

    return [];

  }
};
