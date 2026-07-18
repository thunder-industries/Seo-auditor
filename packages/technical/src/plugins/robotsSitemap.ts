import axios from "axios";
import type { AuditContext, AuditPlugin, Finding } from "@seo-auditor/plugins";

const TIMEOUT_MS = 15000;

async function exists(url: string): Promise<boolean> {
  try {
    const response = await axios.get(url, { timeout: TIMEOUT_MS });
    return response.status === 200;
  } catch {
    return false;
  }
}

/** Harvested from index.js's checkRobots/checkSitemap. */
export const robotsSitemapPlugin: AuditPlugin = {
  name: "robots-sitemap",
  version: "0.1.0",
  category: "technical",
  scope: "domain",

  async run(_page, context: AuditContext): Promise<Finding[]> {

    const robotsUrl = new URL("/robots.txt", context.url).href;
    const sitemapUrl = new URL("/sitemap.xml", context.url).href;

    const [hasRobots, hasSitemap] = await Promise.all([
      exists(robotsUrl),
      exists(sitemapUrl)
    ]);

    const findings: Finding[] = [];

    if (!hasRobots) {
      findings.push({
        pluginName: "robots-sitemap",
        category: "technical",
        severity: "info",
        message: "robots.txt not found."
      });
    }

    if (!hasSitemap) {
      findings.push({
        pluginName: "robots-sitemap",
        category: "technical",
        severity: "info",
        message: "sitemap.xml not found."
      });
    }

    return findings;

  }
};
