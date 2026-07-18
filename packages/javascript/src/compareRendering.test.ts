import { describe, expect, it } from "vitest";
import { compareRendering } from "./compareRendering.js";
import type { ParsedPage } from "@seo-auditor/parser";

function makePage(overrides: Partial<ParsedPage> = {}): ParsedPage {
  return {
    url: "https://example.com",
    title: "",
    description: "",
    language: "en",
    canonical: null,
    metaGenerator: null,
    headings: [],
    images: [],
    scripts: [],
    stylesheets: [],
    links: [],
    internalLinks: [],
    externalLinks: [],
    emails: [],
    phones: [],
    ...overrides
  };
}

describe("compareRendering", () => {

  it("produces no findings when raw and rendered are identical", () => {
    const page = makePage({ title: "Same Title", description: "Same description" });
    const html = "<html><body><p>Some static content here.</p></body></html>";

    const findings = compareRendering({
      rawPage: page,
      rawHtml: html,
      renderedPage: page,
      renderedHtml: html,
      consoleErrors: []
    });

    expect(findings).toHaveLength(0);
  });

  it("flags a title only present after rendering", () => {
    const findings = compareRendering({
      rawPage: makePage({ title: "" }),
      rawHtml: "<html><body></body></html>",
      renderedPage: makePage({ title: "Rendered Title" }),
      renderedHtml: "<html><body></body></html>",
      consoleErrors: []
    });

    const titleFinding = findings.find(f => f.message.includes("Title"));
    expect(titleFinding).toBeTruthy();
    expect(titleFinding!.severity).toBe("warning");
  });

  it("flags a description only present after rendering", () => {
    const findings = compareRendering({
      rawPage: makePage({ description: "" }),
      rawHtml: "<html><body></body></html>",
      renderedPage: makePage({ description: "Rendered description" }),
      renderedHtml: "<html><body></body></html>",
      consoleErrors: []
    });

    expect(findings.some(f => f.message.includes("Meta description"))).toBe(true);
  });

  it("flags headings that only appear after rendering", () => {
    const findings = compareRendering({
      rawPage: makePage({ headings: [] }),
      rawHtml: "<html><body></body></html>",
      renderedPage: makePage({ headings: ["New heading"] }),
      renderedHtml: "<html><body></body></html>",
      consoleErrors: []
    });

    expect(findings.some(f => f.message.includes("heading"))).toBe(true);
  });

  it("flags a significant content-length increase after rendering", () => {
    const findings = compareRendering({
      rawPage: makePage(),
      rawHtml: "<html><body><p>short</p></body></html>",
      renderedPage: makePage(),
      renderedHtml: `<html><body><p>${"a".repeat(500)}</p></body></html>`,
      consoleErrors: []
    });

    expect(findings.some(f => f.message.includes("Significant content"))).toBe(true);
  });

  it("does not flag a small, proportionally minor content difference", () => {
    const findings = compareRendering({
      rawPage: makePage(),
      rawHtml: `<html><body><p>${"a".repeat(1000)}</p></body></html>`,
      renderedPage: makePage(),
      renderedHtml: `<html><body><p>${"a".repeat(1050)}</p></body></html>`,
      consoleErrors: []
    });

    expect(findings.some(f => f.message.includes("Significant content"))).toBe(false);
  });

  it("surfaces console errors captured during rendering", () => {
    const findings = compareRendering({
      rawPage: makePage(),
      rawHtml: "<html><body></body></html>",
      renderedPage: makePage(),
      renderedHtml: "<html><body></body></html>",
      consoleErrors: ["TypeError: x is not a function"]
    });

    const errorFinding = findings.find(f => f.message.includes("console error"));
    expect(errorFinding).toBeTruthy();
    expect(errorFinding!.details!.consoleErrors).toEqual(["TypeError: x is not a function"]);
  });

});
