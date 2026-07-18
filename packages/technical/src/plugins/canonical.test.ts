import { describe, expect, it } from "vitest";
import { canonicalPlugin } from "./canonical.js";
import { makeParsedPage } from "../testFixtures.js";

describe("canonicalPlugin", () => {

  it("flags a missing canonical tag as info", async () => {
    const findings = await canonicalPlugin.run(makeParsedPage({ canonical: null }), {} as any);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("info");
  });

  it("passes a self-referencing canonical with no findings", async () => {
    const findings = await canonicalPlugin.run(
      makeParsedPage({ url: "https://example.com/page", canonical: "https://example.com/page" }),
      {} as any
    );
    expect(findings).toHaveLength(0);
  });

  it("flags a canonical pointing elsewhere", async () => {
    const findings = await canonicalPlugin.run(
      makeParsedPage({ url: "https://example.com/page", canonical: "https://example.com/other" }),
      {} as any
    );
    expect(findings).toHaveLength(1);
  });

  it("flags an invalid canonical URL", async () => {
    const findings = await canonicalPlugin.run(
      makeParsedPage({ url: "https://example.com/page", canonical: "http://[invalid" }),
      {} as any
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("warning");
  });

});
