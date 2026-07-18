import axios from "axios";
import robotsParserImport from "robots-parser";
import { parseHtml } from "@seo-auditor/parser";
import { crawlPage } from "./crawlPage.js";
import type { CrawlOptions, CrawledSitePage, SiteCrawlResult } from "./types.js";

// robots-parser's shipped .d.ts combines an ambient `declare module` with a
// default export in the same file, which confuses NodeNext module
// resolution ("not callable"). The runtime export is fine — only the static
// type is broken — so we cast through our own minimal interface instead of
// fighting the package's types.
interface Robot {
  isAllowed(url: string, userAgent?: string): boolean | undefined;
}

const robotsParser = robotsParserImport as unknown as (url: string, contents: string) => Robot;

const DEFAULT_MAX_PAGES = 25;
const DEFAULT_MAX_DEPTH = 3;
const USER_AGENT = "SeoAuditorPlatform/0.1 (+https://your-domain.com)";
const ROBOTS_TIMEOUT_MS = 10000;

function normalizeForDedup(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }
  return parsed.href;
}

async function loadRobots(seedUrl: string): Promise<Robot> {

  const robotsUrl = new URL("/robots.txt", seedUrl).href;

  try {
    const response = await axios.get(robotsUrl, {
      timeout: ROBOTS_TIMEOUT_MS,
      validateStatus: () => true,
      transformResponse: res => res
    });

    const contents = response.status === 200 && typeof response.data === "string"
      ? response.data
      : "";

    return robotsParser(robotsUrl, contents);
  } catch {
    return robotsParser(robotsUrl, "");
  }

}

interface QueueItem {
  url: string;
  depth: number;
  parentUrl: string | null;
}

/**
 * Breadth-first, same-domain, robots.txt-aware crawl of up to `maxPages`
 * pages within `maxDepth` hops of the seed URL. Sequential by design for
 * Phase 2 (politeness default, keeps the change small) — concurrent
 * fetching is natural Phase 3 scope once a job queue exists.
 */
export async function crawlSite(
  seedUrl: string,
  options: CrawlOptions = {}
): Promise<SiteCrawlResult> {

  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;

  const seedHostname = new URL(seedUrl).hostname;
  const robots = await loadRobots(seedUrl);

  const visited = new Set<string>();
  const skippedByRobots: string[] = [];
  const pages: CrawledSitePage[] = [];

  const queue: QueueItem[] = [
    { url: normalizeForDedup(seedUrl), depth: 0, parentUrl: null }
  ];

  while (queue.length > 0 && pages.length < maxPages) {

    const item = queue.shift()!;

    if (visited.has(item.url)) continue;
    visited.add(item.url);

    const allowed = robots.isAllowed(item.url, USER_AGENT) ?? true;

    if (!allowed) {
      skippedByRobots.push(item.url);
      continue;
    }

    let crawled;
    let page;

    try {
      crawled = await crawlPage(item.url);
      page = parseHtml(item.url, crawled.html);
    } catch {
      // Unreachable page (timeout, DNS failure, etc.) — skip, don't abort the crawl.
      continue;
    }

    pages.push({ crawled, page, depth: item.depth, parentUrl: item.parentUrl });

    if (item.depth + 1 > maxDepth) continue;

    for (const href of page.internalLinks) {
      try {
        const resolved = new URL(href, item.url);
        if (resolved.hostname !== seedHostname) continue;

        const key = normalizeForDedup(resolved.href);
        if (!visited.has(key)) {
          queue.push({ url: key, depth: item.depth + 1, parentUrl: item.url });
        }
      } catch {
        // Malformed href — skip.
      }
    }

  }

  return { pages, skippedByRobots, visitedCount: visited.size };

}
