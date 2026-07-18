import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { crawlSite } from "./crawlSite.js";

const ROBOTS_TXT = "User-agent: *\nDisallow: /disallowed\n";

const PAGES: Record<string, string> = {
  "/": `<html><head><title>Hub</title></head><body>
    <a href="/page-a">a</a>
    <a href="/page-b">b</a>
    <a href="https://external.example/somewhere">external</a>
  </body></html>`,
  "/page-a": `<html><head><title>Page A</title></head><body>
    <a href="/page-d">d</a>
  </body></html>`,
  "/page-b": `<html><head><title>Page B</title></head><body>
    <a href="/page-a">back to a</a>
    <a href="/disallowed">disallowed</a>
  </body></html>`,
  "/page-d": `<html><head><title>Page D</title></head><body>leaf page</body></html>`,
  "/disallowed": `<html><head><title>Disallowed</title></head><body>should never be fetched</body></html>`
};

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    const path = (req.url || "/").split("?")[0];

    if (path === "/robots.txt") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end(ROBOTS_TXT);
      return;
    }

    const body = PAGES[path];

    if (!body) {
      res.writeHead(404);
      res.end("not found");
      return;
    }

    res.writeHead(200, { "content-type": "text/html" });
    res.end(body);
  });

  await new Promise<void>(resolve => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://localhost:${port}`;
});

afterAll(() => {
  server.close();
});

describe("crawlSite", () => {

  it("crawls same-domain pages breadth-first, dedupes, and tracks depth/parent", async () => {

    const result = await crawlSite(baseUrl, { maxPages: 25, maxDepth: 3 });

    const byPath = new Map(
      result.pages.map(p => [new URL(p.crawled.url).pathname, p])
    );

    expect(byPath.has("/")).toBe(true);
    expect(byPath.has("/page-a")).toBe(true);
    expect(byPath.has("/page-b")).toBe(true);
    expect(byPath.has("/page-d")).toBe(true);

    expect(byPath.get("/")!.depth).toBe(0);
    expect(byPath.get("/page-a")!.depth).toBe(1);
    expect(byPath.get("/page-b")!.depth).toBe(1);
    expect(byPath.get("/page-d")!.depth).toBe(2);

    // page-a is linked from both "/" and "/page-b" — must be crawled exactly once.
    const pageACount = result.pages.filter(p => new URL(p.crawled.url).pathname === "/page-a").length;
    expect(pageACount).toBe(1);

  });

  it("does not follow external links off the seed domain", async () => {
    const result = await crawlSite(baseUrl, { maxPages: 25, maxDepth: 3 });
    const external = result.pages.find(p => p.crawled.url.includes("external.example"));
    expect(external).toBeUndefined();
  });

  it("skips robots.txt-disallowed pages", async () => {
    const result = await crawlSite(baseUrl, { maxPages: 25, maxDepth: 3 });

    const disallowed = result.pages.find(p => new URL(p.crawled.url).pathname === "/disallowed");
    expect(disallowed).toBeUndefined();

    expect(result.skippedByRobots.some(u => u.includes("/disallowed"))).toBe(true);
  });

  it("respects maxDepth", async () => {
    const result = await crawlSite(baseUrl, { maxPages: 25, maxDepth: 1 });
    const hasDepth2 = result.pages.some(p => p.depth >= 2);
    expect(hasDepth2).toBe(false);
  });

  it("respects maxPages", async () => {
    const result = await crawlSite(baseUrl, { maxPages: 2, maxDepth: 3 });
    expect(result.pages.length).toBeLessThanOrEqual(2);
  });

});
