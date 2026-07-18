import { describe, expect, it } from "vitest";
import { securityHeadersPlugin } from "./securityHeaders.js";
import type { AuditContext } from "@seo-auditor/plugins";
import type { CrawledPage } from "@seo-auditor/crawler";

function makeContext(headers: Record<string, string>): AuditContext {
  return {
    url: "https://example.com",
    crawled: {
      url: "https://example.com",
      status: 200,
      responseTimeMs: 10,
      headers,
      html: "",
      htmlSize: 0,
      contentHash: "",
      https: true
    } as CrawledPage
  };
}

describe("securityHeadersPlugin", () => {

  it("flags all headers as missing when none are present", async () => {
    const findings = await securityHeadersPlugin.run({} as any, makeContext({}));
    expect(findings).toHaveLength(6);
  });

  it("flags HSTS absence as a warning, others as info", async () => {
    const findings = await securityHeadersPlugin.run({} as any, makeContext({}));
    const hsts = findings.find(f => f.message.includes("Strict-Transport-Security"));
    const csp = findings.find(f => f.message.includes("Content-Security-Policy"));

    expect(hsts?.severity).toBe("warning");
    expect(csp?.severity).toBe("info");
  });

  it("produces no findings when all headers are present", async () => {
    const findings = await securityHeadersPlugin.run({} as any, makeContext({
      "strict-transport-security": "max-age=63072000",
      "content-security-policy": "default-src 'self'",
      "x-frame-options": "DENY",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "permissions-policy": "geolocation=()"
    }));

    expect(findings).toHaveLength(0);
  });

});
