import axios from "axios";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import type { CrawledPage } from "./types.js";

const DEFAULT_TIMEOUT_MS = 15000;
const USER_AGENT = "SeoAuditorPlatform/0.1 (+https://your-domain.com)";

/**
 * Fetches a single URL. This is the Phase 1 "crawler" — one page, no queue,
 * no link-following. Multi-page crawling is a later phase; this function is
 * the unit a future queue-based crawler will call per URL.
 */
export async function crawlPage(url: string): Promise<CrawledPage> {

  const start = performance.now();

  const response = await axios.get<string>(url, {
    timeout: DEFAULT_TIMEOUT_MS,
    headers: { "User-Agent": USER_AGENT },
    transformResponse: res => res // keep raw string, don't let axios auto-parse JSON
  });

  const responseTimeMs = Math.round(performance.now() - start);

  const html =
    typeof response.data === "string"
      ? response.data
      : JSON.stringify(response.data);

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(response.headers)) {
    headers[key] = Array.isArray(value) ? value.join(", ") : String(value);
  }

  return {
    url,
    status: response.status,
    responseTimeMs,
    headers,
    html,
    htmlSize: Buffer.byteLength(html, "utf8"),
    contentHash: createHash("sha256").update(html).digest("hex").slice(0, 12),
    https: url.startsWith("https://")
  };

}
