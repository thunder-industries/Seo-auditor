import axios from "axios";
import type { CrawledSitePage } from "@seo-auditor/crawler";
import type { Finding } from "@seo-auditor/plugins";

const BROKEN_LINK_CAP = 25;
const BROKEN_LINK_CONCURRENCY = 5;
const BROKEN_LINK_TIMEOUT_MS = 8000;
const USER_AGENT = "SeoAuditorPlatform/0.1 (+https://your-domain.com)";

function normalizeForCompare(url: string): string {
  return url.replace(/\/$/, "");
}

function findDuplicates(
  pages: CrawledSitePage[],
  selector: (p: CrawledSitePage) => string,
  label: string,
  pluginName: string
): Finding[] {

  const groups = new Map<string, string[]>();

  for (const p of pages) {
    const value = selector(p).trim();
    if (!value) continue;

    const urls = groups.get(value) ?? [];
    urls.push(p.crawled.url);
    groups.set(value, urls);
  }

  const findings: Finding[] = [];

  for (const [value, urls] of groups) {
    if (urls.length > 1) {
      findings.push({
        pluginName,
        category: "technical",
        severity: "warning",
        message: `Duplicate ${label} ("${value}") found on ${urls.length} pages.`,
        details: { value, urls }
      });
    }
  }

  return findings;

}

/**
 * Flags pages linked from only one other page in the crawled set. This is
 * NOT orphan-page detection — since this crawler only discovers URLs by
 * following links, every non-seed page necessarily has at least one inbound
 * link by construction (that's how it was queued), so a "zero inbound
 * links" check could never fire. True orphan detection needs a second
 * discovery source (e.g. sitemap.xml) to compare against the link graph —
 * deferred to a later phase. This check instead surfaces pages that are
 * fragile from a link-equity/discoverability standpoint.
 */
function findWeaklyLinkedPages(pages: CrawledSitePage[]): Finding[] {

  const inboundCounts = new Map<string, number>();

  for (const p of pages) {
    inboundCounts.set(normalizeForCompare(p.crawled.url), 0);
  }

  for (const p of pages) {
    for (const href of p.page.internalLinks) {
      try {
        const resolved = normalizeForCompare(new URL(href, p.crawled.url).href);
        if (resolved === normalizeForCompare(p.crawled.url)) continue;
        if (inboundCounts.has(resolved)) {
          inboundCounts.set(resolved, (inboundCounts.get(resolved) ?? 0) + 1);
        }
      } catch {
        // malformed href, ignore
      }
    }
  }

  const findings: Finding[] = [];

  for (const p of pages) {
    if (p.depth === 0) continue; // seed page isn't evaluated for inbound links

    const count = inboundCounts.get(normalizeForCompare(p.crawled.url)) ?? 0;

    if (count <= 1) {
      findings.push({
        pluginName: "site-link-graph",
        category: "technical",
        severity: "info",
        message: `Page is linked from only ${count} other crawled page(s) — weak internal linking: ${p.crawled.url}`
      });
    }
  }

  return findings;

}

async function findBrokenLinks(pages: CrawledSitePage[]): Promise<Finding[]> {

  const allInternal = new Set<string>();

  for (const p of pages) {
    for (const href of p.page.internalLinks) {
      try {
        allInternal.add(new URL(href, p.crawled.url).href);
      } catch {
        // malformed href, ignore
      }
    }
  }

  const candidates = [...allInternal].slice(0, BROKEN_LINK_CAP);
  const findings: Finding[] = [];
  let index = 0;

  async function worker() {
    while (index < candidates.length) {

      const url = candidates[index++];

      try {

        let res = await axios.head(url, {
          timeout: BROKEN_LINK_TIMEOUT_MS,
          validateStatus: () => true,
          headers: { "User-Agent": USER_AGENT }
        });

        if (res.status === 405) {
          res = await axios.get(url, {
            timeout: BROKEN_LINK_TIMEOUT_MS,
            validateStatus: () => true,
            headers: { "User-Agent": USER_AGENT }
          });
        }

        if (res.status >= 400) {
          findings.push({
            pluginName: "site-broken-links",
            category: "technical",
            severity: "warning",
            message: `Broken internal link (${res.status}): ${url}`
          });
        }

      } catch {
        findings.push({
          pluginName: "site-broken-links",
          category: "technical",
          severity: "warning",
          message: `Broken internal link (unreachable): ${url}`
        });
      }

    }
  }

  await Promise.all(Array.from({ length: BROKEN_LINK_CONCURRENCY }, worker));

  return findings;

}

export async function computeSiteFindings(pages: CrawledSitePage[]): Promise<Finding[]> {

  const broken = await findBrokenLinks(pages);

  return [
    ...findDuplicates(pages, p => p.page.title, "title", "site-duplicate-title"),
    ...findDuplicates(pages, p => p.page.description, "description", "site-duplicate-description"),
    ...findWeaklyLinkedPages(pages),
    ...broken
  ];

}
