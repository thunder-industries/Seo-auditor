import { describe, expect, it } from "vitest";
import { computeScore } from "./scoreEngine.js";
import type { Finding } from "@seo-auditor/plugins";

function finding(category: string, severity: Finding["severity"]): Finding {
  return { pluginName: "x", category, severity, message: "x" };
}

describe("computeScore", () => {

  it("scores a category with no findings as 100", () => {
    const result = computeScore([], ["technical", "security"]);
    expect(result.byCategory.technical).toBe(100);
    expect(result.byCategory.security).toBe(100);
    expect(result.overall).toBe(100);
  });

  it("subtracts penalties per severity and clamps at 0", () => {
    const findings = [
      finding("technical", "critical"),
      finding("technical", "critical"),
      finding("technical", "critical"),
      finding("technical", "critical"),
      finding("technical", "critical")
    ];

    const result = computeScore(findings, ["technical", "security"]);

    expect(result.byCategory.technical).toBe(0); // 5 * 25 = 125 penalty, clamped
    expect(result.byCategory.security).toBe(100);
    expect(result.overall).toBe(50); // (0*0.5 + 100*0.5)
  });

  it("excludes categories with no registered plugins from the average", () => {
    const result = computeScore(
      [finding("technical", "warning")],
      ["technical"]
    );

    // Only "technical" contributes; security isn't in the registered list.
    expect(result.byCategory).toEqual({ technical: 90 });
    expect(result.overall).toBe(90);
  });

  it("weights categories according to CATEGORY_WEIGHTS", () => {
    const findings = [finding("technical", "critical")]; // technical: 75
    const result = computeScore(findings, ["technical", "security"]);

    expect(result.byCategory.technical).toBe(75);
    expect(result.byCategory.security).toBe(100);
    expect(result.overall).toBe(88); // round(75*0.5 + 100*0.5) = round(87.5) = 88
  });

  it("does not penalize info-level findings", () => {
    const findings = [
      finding("technical", "info"),
      finding("technical", "info"),
      finding("technical", "info")
    ];

    const result = computeScore(findings, ["technical", "security"]);

    expect(result.byCategory.technical).toBe(100);
    expect(result.overall).toBe(100);
  });

});
