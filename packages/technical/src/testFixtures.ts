import type { ParsedPage } from "@seo-auditor/parser";

export function makeParsedPage(overrides: Partial<ParsedPage> = {}): ParsedPage {
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
