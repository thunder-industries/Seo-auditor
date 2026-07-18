import { useState, type FormEvent } from "react";
import { runPageAudit, type AuditReport } from "../api";
import { AuditReportView } from "./AuditReportView";

export function PageAuditView() {
  const [url, setUrl] = useState("");
  const [renderJs, setRenderJs] = useState(false);
  const [checkPerformance, setCheckPerformance] = useState(false);
  const [checkAccessibility, setCheckAccessibility] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AuditReport | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const result = await runPageAudit(url.trim(), { renderJs, checkPerformance, checkAccessibility });
      setReport(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="view">
      <form className="audit-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={loading}
        />
        <div className="audit-form__options">
          <label>
            <input type="checkbox" checked={renderJs} onChange={(e) => setRenderJs(e.target.checked)} disabled={loading} />
            Render JavaScript
          </label>
          <label>
            <input
              type="checkbox"
              checked={checkPerformance}
              onChange={(e) => setCheckPerformance(e.target.checked)}
              disabled={loading}
            />
            Check performance
          </label>
          <label>
            <input
              type="checkbox"
              checked={checkAccessibility}
              onChange={(e) => setCheckAccessibility(e.target.checked)}
              disabled={loading}
            />
            Check accessibility
          </label>
        </div>
        <button type="submit" disabled={loading || !url.trim()}>
          {loading ? "Auditing…" : "Run audit"}
        </button>
      </form>

      {error && <p className="error-banner">{error}</p>}
      {report && <AuditReportView report={report} />}
    </div>
  );
}
