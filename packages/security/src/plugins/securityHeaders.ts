import type { AuditContext, AuditPlugin, Finding } from "@seo-auditor/plugins";

const CHECKED_HEADERS: Record<string, string> = {
  "strict-transport-security": "Strict-Transport-Security",
  "content-security-policy": "Content-Security-Policy",
  "x-frame-options": "X-Frame-Options",
  "x-content-type-options": "X-Content-Type-Options",
  "referrer-policy": "Referrer-Policy",
  "permissions-policy": "Permissions-Policy"
};

/** Harvested from index.js's auditSecurityHeaders. */
export const securityHeadersPlugin: AuditPlugin = {
  name: "security-headers",
  version: "0.1.0",
  category: "security",
  scope: "domain",

  run(_page, context: AuditContext): Finding[] {

    const findings: Finding[] = [];

    for (const [headerKey, label] of Object.entries(CHECKED_HEADERS)) {
      const value = context.crawled.headers[headerKey];

      if (!value) {
        findings.push({
          pluginName: "security-headers",
          category: "security",
          severity: headerKey === "strict-transport-security" ? "warning" : "info",
          message: `Missing ${label} header.`
        });
      }
    }

    return findings;

  }
};
