import type { AuditReport } from "./types.js";

export function formatJson(report: AuditReport): string {
  return JSON.stringify(report, null, 2);
}

export function formatText(report: AuditReport): string {

  const lines: string[] = [];

  lines.push(`SEO Audit — ${report.target}`);
  lines.push(`Generated: ${report.createdAt}`);
  lines.push(`Overall Score: ${report.score.overall}/100`);

  for (const [category, score] of Object.entries(report.score.byCategory)) {
    lines.push(`  ${category}: ${score}/100`);
  }

  lines.push("");
  lines.push(`Title: ${report.page.title || "(none)"}`);
  lines.push(`Status: ${report.crawl.status} | HTTPS: ${report.crawl.https ? "yes" : "no"}`);

  lines.push("");
  lines.push(`Findings (${report.findings.length}):`);

  for (const finding of report.findings) {
    lines.push(`  [${finding.severity.toUpperCase()}] ${finding.pluginName}: ${finding.message}`);
  }

  return lines.join("\n");

}
