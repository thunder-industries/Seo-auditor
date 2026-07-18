import { describe, expect, it } from "vitest";
import { headingStructurePlugin } from "./headingStructure.js";
import { makeParsedPage } from "../testFixtures.js";

describe("headingStructurePlugin", () => {

  it("flags a missing H1", async () => {
    const findings = await headingStructurePlugin.run(makeParsedPage({ headings: [] }), {} as any);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("warning");
  });

  it("flags multiple H1s", async () => {
    const findings = await headingStructurePlugin.run(
      makeParsedPage({ headings: ["First", "Second"] }),
      {} as any
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toMatch(/Multiple H1/);
  });

  it("passes exactly one H1 with no findings", async () => {
    const findings = await headingStructurePlugin.run(
      makeParsedPage({ headings: ["Only heading"] }),
      {} as any
    );
    expect(findings).toHaveLength(0);
  });

});
