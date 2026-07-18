import { describe, expect, it } from "vitest";
import { thresholdFinding } from "./runPerformanceAudit.js";

// Pure logic, no browser/spawn needed — the gap that let the CLS
// message-rounding bug (0.15 -> "0") through review undetected, since
// every real target audited so far happened to have a real CLS of exactly
// 0, which rounds "correctly" either way.
describe("thresholdFinding", () => {

  it("scores below the good threshold as info", () => {
    const finding = thresholdFinding("Total Blocking Time", 50, 200, 600, "ms");
    expect(finding.severity).toBe("info");
  });

  it("scores between good and poor as warning", () => {
    const finding = thresholdFinding("Total Blocking Time", 300, 200, 600, "ms");
    expect(finding.severity).toBe("warning");
  });

  it("scores at or above poor as critical", () => {
    const finding = thresholdFinding("Total Blocking Time", 700, 200, 600, "ms");
    expect(finding.severity).toBe("critical");
  });

  it("formats a unitless decimal metric (CLS) with real precision, not rounded to an integer", () => {
    const finding = thresholdFinding("Cumulative Layout Shift", 0.15, 0.1, 0.25, "", 2);
    expect(finding.message).toContain("0.15");
    expect(finding.severity).toBe("warning");
  });

  it("still reports a critical CLS value legibly", () => {
    const finding = thresholdFinding("Cumulative Layout Shift", 0.3, 0.1, 0.25, "", 2);
    expect(finding.message).toContain("0.30");
    expect(finding.severity).toBe("critical");
  });

});
