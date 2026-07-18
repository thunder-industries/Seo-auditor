import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { computeSiteFindings } from "./siteFindings.js";
import type { CrawledSitePage } from "@seo-auditor/crawler";

function makeSitePage(overrides: {
  url: string;
  title?: string;
  description?: string;
  depth: number;
  internalLinks?: string[];
}): CrawledSitePage {
  return {
    crawled: {
      url: overrides.url,
      status: 200,
      responseTimeMs: 10,
      headers: {},
      html: "",
      htmlSize: 0,
      contentHash: "",
      https: false
    },
    page: {
      url: overrides.url,
      title: overrides.title ?? "",
      description: overrides.description ?? "",
      language: "en",
      canonical: null,
      metaGenerator: null,
      headings: [],
      images: [],
      scripts: [],
      stylesheets: [],
      links: overrides.internalLinks ?? [],
      internalLinks: overrides.internalLinks ?? [],
      externalLinks: [],
      emails: [],
      phones: []
    },
    depth: overrides.depth,
    parentUrl: overrides.depth === 0 ? null : "http://127.0.0.1:1/"
  };
}

describe("computeSiteFindings", () => {

  it("flags duplicate titles and descriptions across pages", async () => {

    const pages = [
      makeSitePage({ url: "http://127.0.0.1:1/a", title: "Same Title", description: "Same description text", depth: 1, internalLinks: [] }),
      makeSitePage({ url: "http://127.0.0.1:1/b", title: "Same Title", description: "Same description text", depth: 1, internalLinks: [] }),
      makeSitePage({ url: "http://127.0.0.1:1/c", title: "Unique Title", description: "Unique description", depth: 1, internalLinks: [] })
    ];

    const findings = await computeSiteFindings(pages);

    const dupTitle = findings.find(f => f.pluginName === "site-duplicate-title");
    const dupDesc = findings.find(f => f.pluginName === "site-duplicate-description");

    expect(dupTitle).toBeTruthy();
    expect((dupTitle!.details!.urls as string[])).toHaveLength(2);
    expect(dupDesc).toBeTruthy();
  });

  it("does not flag empty titles/descriptions as duplicates", async () => {
    const pages = [
      makeSitePage({ url: "http://127.0.0.1:1/a", title: "", description: "", depth: 1 }),
      makeSitePage({ url: "http://127.0.0.1:1/b", title: "", description: "", depth: 1 })
    ];

    const findings = await computeSiteFindings(pages);
    expect(findings.find(f => f.pluginName === "site-duplicate-title")).toBeUndefined();
    expect(findings.find(f => f.pluginName === "site-duplicate-description")).toBeUndefined();
  });

  it("flags pages with only one inbound internal link as weakly linked", async () => {

    const pages = [
      makeSitePage({ url: "http://127.0.0.1:1/", title: "Home", depth: 0, internalLinks: ["/a", "/b"] }),
      makeSitePage({ url: "http://127.0.0.1:1/a", title: "A", depth: 1, internalLinks: ["/b"] }),
      makeSitePage({ url: "http://127.0.0.1:1/b", title: "B", depth: 1, internalLinks: [] })
    ];

    const findings = await computeSiteFindings(pages);
    const linkGraphFindings = findings.filter(f => f.pluginName === "site-link-graph");

    // "/a" has 1 inbound link (from "/"), "/b" has 2 inbound links (from "/" and "/a")
    expect(linkGraphFindings.some(f => f.message.includes("http://127.0.0.1:1/a"))).toBe(true);
    expect(linkGraphFindings.some(f => f.message.includes("http://127.0.0.1:1/b"))).toBe(false);
  });

  it("does not evaluate the seed (depth 0) page for weak linking", async () => {
    const pages = [
      makeSitePage({ url: "http://127.0.0.1:1/", title: "Home", depth: 0, internalLinks: [] })
    ];

    const findings = await computeSiteFindings(pages);
    expect(findings.find(f => f.pluginName === "site-link-graph")).toBeUndefined();
  });

});

describe("computeSiteFindings broken link detection", () => {

  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === "/ok") {
        res.writeHead(200);
        res.end("ok");
        return;
      }
      res.writeHead(404);
      res.end("not found");
    });

    await new Promise<void>(resolve => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://localhost:${port}`;
  });

  afterAll(() => {
    server.close();
  });

  it("flags internal links that resolve to 4xx/5xx", async () => {

    const pages = [
      makeSitePage({
        url: `${baseUrl}/`,
        depth: 0,
        internalLinks: [`${baseUrl}/ok`, `${baseUrl}/missing`]
      })
    ];

    const findings = await computeSiteFindings(pages);
    const broken = findings.filter(f => f.pluginName === "site-broken-links");

    expect(broken).toHaveLength(1);
    expect(broken[0].message).toContain("/missing");
  });

});
