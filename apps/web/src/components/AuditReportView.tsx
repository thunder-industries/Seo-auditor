import type { AuditReport } from "../api";
import { ScoreBreakdown } from "./ScoreBadge";
import { FindingsList } from "./FindingsList";

export function AuditReportView({ report }: { report: AuditReport }) {
  return (
    <div className="report">
      <header className="report__header">
        <h2 className="report__title">{report.page.title || report.target}</h2>
        <a href={report.target} target="_blank" rel="noreferrer" className="report__target">
          {report.target}
        </a>
      </header>

      <ScoreBreakdown result={report.score} />

      <section className="report__section">
        <h3>Crawl</h3>
        <dl className="kv-grid">
          <dt>Status</dt>
          <dd>{report.crawl.status}</dd>
          <dt>Response time</dt>
          <dd>{report.crawl.responseTimeMs} ms</dd>
          <dt>HTTPS</dt>
          <dd>{report.crawl.https ? "Yes" : "No"}</dd>
          <dt>HTML size</dt>
          <dd>{(report.crawl.htmlSize / 1024).toFixed(1)} KB</dd>
          <dt>Server</dt>
          <dd>{report.crawl.server ?? "—"}</dd>
        </dl>
      </section>

      <section className="report__section">
        <h3>Page</h3>
        <dl className="kv-grid">
          <dt>Description</dt>
          <dd>{report.page.description || "—"}</dd>
          <dt>Language</dt>
          <dd>{report.page.language || "—"}</dd>
          <dt>Canonical</dt>
          <dd>{report.page.canonical ?? "—"}</dd>
          <dt>Headings</dt>
          <dd>{report.page.headingCount}</dd>
          <dt>Images</dt>
          <dd>{report.page.imageCount}</dd>
          <dt>Scripts / Stylesheets</dt>
          <dd>{report.page.scriptCount} / {report.page.stylesheetCount}</dd>
          <dt>Internal / External links</dt>
          <dd>{report.page.internalLinkCount} / {report.page.externalLinkCount}</dd>
        </dl>
      </section>

      {report.performance?.attempted && (
        <section className="report__section">
          <h3>Performance</h3>
          {report.performance.succeeded ? (
            <dl className="kv-grid">
              <dt>Lighthouse score</dt>
              <dd>{report.performance.score}</dd>
              <dt>LCP</dt>
              <dd>{report.performance.metrics?.lcpMs} ms</dd>
              <dt>CLS</dt>
              <dd>{report.performance.metrics?.cls}</dd>
              <dt>TBT</dt>
              <dd>{report.performance.metrics?.tbtMs} ms</dd>
              <dt>FCP</dt>
              <dd>{report.performance.metrics?.fcpMs} ms</dd>
              <dt>Speed Index</dt>
              <dd>{report.performance.metrics?.siMs} ms</dd>
            </dl>
          ) : (
            <p className="report__error">Performance check failed: {report.performance.error}</p>
          )}
        </section>
      )}

      {report.accessibility?.attempted && (
        <section className="report__section">
          <h3>Accessibility</h3>
          {report.accessibility.succeeded ? (
            <p>{report.accessibility.violationCount} violation(s) found</p>
          ) : (
            <p className="report__error">Accessibility check failed: {report.accessibility.error}</p>
          )}
        </section>
      )}

      {report.rendering?.attempted && (
        <section className="report__section">
          <h3>JavaScript rendering</h3>
          {report.rendering.succeeded ? (
            <p>
              Rendered successfully
              {report.rendering.consoleErrors && report.rendering.consoleErrors.length > 0
                ? ` — ${report.rendering.consoleErrors.length} console error(s)`
                : ""}
            </p>
          ) : (
            <p className="report__error">Rendering failed: {report.rendering.error}</p>
          )}
        </section>
      )}

      <section className="report__section">
        <h3>Findings ({report.findings.length})</h3>
        <FindingsList findings={report.findings} />
      </section>
    </div>
  );
}
