import { useEffect, useRef, useState, type FormEvent } from "react";
import { getSiteAuditStatus, startSiteAudit, type SiteAuditReport, type SiteAuditStatus } from "../api";
import { ScoreBreakdown } from "./ScoreBadge";
import { FindingsList } from "./FindingsList";
import { AuditReportView } from "./AuditReportView";

const POLL_INTERVAL_MS = 2000;

export function SiteAuditView() {
  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState(20);
  const [maxDepth, setMaxDepth] = useState(3);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState<SiteAuditStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedPage, setExpandedPage] = useState<number | null>(null);

  const pollHandle = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!activeId) return;

    let cancelled = false;

    async function poll() {
      try {
        const result = await getSiteAuditStatus(activeId!);
        if (cancelled) return;

        setStatus(result);

        if (result.status === "queued" || result.status === "active") {
          pollHandle.current = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to fetch status");
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (pollHandle.current) clearTimeout(pollHandle.current);
    };
  }, [activeId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!url.trim()) return;

    setError(null);
    setStatus(null);
    setActiveId(null);
    setExpandedPage(null);

    try {
      const { id } = await startSiteAudit(url.trim(), { maxPages, maxDepth });
      setActiveId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start site audit");
    }
  }

  const isRunning = status?.status === "queued" || status?.status === "active";
  const report = status?.status === "completed" ? (status as SiteAuditReport) : null;

  return (
    <div className="view">
      <form className="audit-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={isRunning}
        />
        <div className="audit-form__options">
          <label>
            Max pages
            <input
              type="number"
              min={1}
              max={100}
              value={maxPages}
              onChange={(e) => setMaxPages(Number(e.target.value))}
              disabled={isRunning}
            />
          </label>
          <label>
            Max depth
            <input
              type="number"
              min={1}
              max={10}
              value={maxDepth}
              onChange={(e) => setMaxDepth(Number(e.target.value))}
              disabled={isRunning}
            />
          </label>
        </div>
        <button type="submit" disabled={isRunning || !url.trim()}>
          {isRunning ? "Crawling…" : "Start site audit"}
        </button>
      </form>

      {error && <p className="error-banner">{error}</p>}

      {isRunning && (
        <p className="status-banner status-banner--pending">
          Status: {status?.status}
          {status?.status === "active" ? " — crawling pages" : " — waiting for a worker"}
        </p>
      )}

      {status?.status === "failed" && (
        <p className="error-banner">Site audit failed: {status.error ?? "unknown error"}</p>
      )}

      {report && (
        <div className="report">
          <header className="report__header">
            <h2 className="report__title">{report.target}</h2>
            <p className="report__target">
              {report.pagesCrawled} page(s) crawled
              {report.maxPagesReached ? " (max pages reached)" : ""}
            </p>
          </header>

          <ScoreBreakdown result={report.score} />

          {report.siteFindings.length > 0 && (
            <section className="report__section">
              <h3>Site-wide findings ({report.siteFindings.length})</h3>
              <FindingsList findings={report.siteFindings} />
            </section>
          )}

          <section className="report__section">
            <h3>Pages ({report.pages.length})</h3>
            <ul className="page-list">
              {report.pages.map((page, i) => (
                <li key={page.id} className="page-list__item">
                  <button
                    type="button"
                    className="page-list__toggle"
                    onClick={() => setExpandedPage(expandedPage === i ? null : i)}
                  >
                    <span>{page.page.title || page.target}</span>
                    <span className="score-badge score-badge--inline">{page.score.overall}</span>
                  </button>
                  {expandedPage === i && (
                    <div className="page-list__detail">
                      <AuditReportView report={page} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
