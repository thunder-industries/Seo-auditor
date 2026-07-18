import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { Finding, Severity } from "@seo-auditor/plugins";

const execFileAsync = promisify(execFile);

// Lighthouse can't run in this process — see lighthouseChild.mjs for why.
// This spawns a plain `node` child (never inheriting tsx/vitest's esbuild
// transform) and reads its single line of stdout JSON back.
const CHILD_SCRIPT_PATH = fileURLToPath(new URL("./lighthouseChild.mjs", import.meta.url));

export interface PerformanceMetrics {
  lcpMs: number;
  cls: number;
  tbtMs: number;
  fcpMs: number;
  siMs: number;
}

export interface PerformanceResult {
  score: number;
  metrics: PerformanceMetrics;
  findings: Finding[];
}

/**
 * good / needs-improvement / poor thresholds, per Google's published Core
 * Web Vitals guidance. Heuristic and documented as such — not tuned to any
 * particular site category, same spirit as compareRendering's thresholds.
 *
 * `decimals` matters: CLS is a unitless score in the ~0.0-0.5 range, so
 * rounding it to an integer (fine for the millisecond metrics) collapses
 * any real value below 0.5 to "0" — found via review, since every test
 * target happened to have a real CLS of exactly 0, which looked correct
 * either way.
 */
export function thresholdFinding(
  name: string,
  value: number,
  good: number,
  poor: number,
  unit: string,
  decimals = 0
): Finding {
  const severity: Severity = value >= poor ? "critical" : value >= good ? "warning" : "info";
  return {
    pluginName: "lighthouse-performance",
    category: "performance",
    severity,
    message: `${name}: ${value.toFixed(decimals)}${unit} (good <${good}${unit}, poor >=${poor}${unit})`
  };
}

/** Runs a Lighthouse performance audit against a real page load. */
export async function runPerformanceAudit(url: string): Promise<PerformanceResult> {

  const { stdout } = await execFileAsync(process.execPath, [CHILD_SCRIPT_PATH, url], {
    maxBuffer: 10 * 1024 * 1024
  });

  const { score, metrics } = JSON.parse(stdout) as { score: number; metrics: PerformanceMetrics };

  const findings: Finding[] = [
    thresholdFinding("Largest Contentful Paint", metrics.lcpMs, 2500, 4000, "ms"),
    thresholdFinding("Cumulative Layout Shift", metrics.cls, 0.1, 0.25, "", 2),
    thresholdFinding("Total Blocking Time", metrics.tbtMs, 200, 600, "ms")
  ];

  if (score < 90) {
    findings.push({
      pluginName: "lighthouse-performance",
      category: "performance",
      severity: score < 50 ? "critical" : "warning",
      message: `Lighthouse performance score is ${score}/100.`
    });
  }

  return { score, metrics, findings };

}
