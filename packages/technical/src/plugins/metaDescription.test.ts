import { describe, expect, it } from "vitest";
import { metaDescriptionPlugin } from "./metaDescription.js";
import { makeParsedPage } from "../testFixtures.js";

describe("metaDescriptionPlugin", () => {

  it("flags a missing description as warning", async () => {
    const findings = await metaDescriptionPlugin.run(makeParsedPage({ description: "" }), {} as any);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("warning");
  });

  it("flags a short description as info", async () => {
    const findings = await metaDescriptionPlugin.run(makeParsedPage({ description: "Too short" }), {} as any);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("info");
  });

  it("passes a well-sized description with no findings", async () => {
    const description = "A".repeat(100);
    const findings = await metaDescriptionPlugin.run(makeParsedPage({ description }), {} as any);
    expect(findings).toHaveLength(0);
  });

});
