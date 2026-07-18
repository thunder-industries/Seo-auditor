import { describe, expect, it } from "vitest";
import { titleTagPlugin } from "./titleTag.js";
import { makeParsedPage } from "../testFixtures.js";

describe("titleTagPlugin", () => {

  it("flags a missing title as critical", async () => {
    const findings = await titleTagPlugin.run(makeParsedPage({ title: "" }), {} as any);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("critical");
  });

  it("flags a short title as info", async () => {
    const findings = await titleTagPlugin.run(makeParsedPage({ title: "Too short" }), {} as any);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("info");
  });

  it("flags a long title as warning", async () => {
    const longTitle = "A".repeat(80);
    const findings = await titleTagPlugin.run(makeParsedPage({ title: longTitle }), {} as any);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("warning");
  });

  it("passes a well-sized title with no findings", async () => {
    const findings = await titleTagPlugin.run(
      makeParsedPage({ title: "A well sized title for search results" }),
      {} as any
    );
    expect(findings).toHaveLength(0);
  });

});
