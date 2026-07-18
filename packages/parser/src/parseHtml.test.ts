import { describe, expect, it } from "vitest";
import { parseHtml } from "./parseHtml.js";

const TARGET = "https://example.com";

function html(body: string) {
  return `<html lang="en"><head><title>Test</title></head><body>${body}</body></html>`;
}

describe("parseHtml link classification", () => {

  it("excludes mailto, tel, javascript, and anchor links from links/internal/external", () => {
    const page = parseHtml(TARGET, html(`
      <a href="mailto:someone@example.com">mail</a>
      <a href="tel:+15551234567">call</a>
      <a href="javascript:void(0)">js</a>
      <a href="#top">anchor</a>
      <a href="/about">about</a>
    `));

    expect(page.links).toEqual(["/about"]);
    expect(page.internalLinks).toEqual(["/about"]);
    expect(page.externalLinks).toEqual([]);
  });

  it("classifies absolute and protocol-relative links by hostname, not substring match", () => {
    const page = parseHtml(TARGET, html(`
      <a href="https://external.com/page">external</a>
      <a href="//cdn.example.net/lib.js">protocol relative external</a>
      <a href="https://example.com/pricing">internal absolute</a>
    `));

    expect(page.internalLinks).toEqual(["https://example.com/pricing"]);
    expect(page.externalLinks).toEqual([
      "https://external.com/page",
      "//cdn.example.net/lib.js"
    ]);
  });

  it("does not throw on a malformed href and falls back to internal", () => {
    const page = parseHtml(TARGET, html(`<a href="http://[invalid">broken</a>`));

    expect(page.links).toEqual(["http://[invalid"]);
    expect(page.internalLinks).toEqual(["http://[invalid"]);
  });

  it("filters asset-filename false positives out of extracted emails", () => {
    const page = parseHtml(TARGET, html(`
      <img src="logo@2x.png">
      Contact real.person@company.com or fake@2x.jpg
    `));

    expect(page.emails).toEqual(["real.person@company.com"]);
  });

  it("does not flag bare digit runs as phone numbers but does catch separated ones", () => {
    const page = parseHtml(TARGET, html(`
      Order ID 1234567890123 was shipped. Call 555-867-5309.
    `));

    expect(page.phones).toEqual(["555-867-5309"]);
  });

});
