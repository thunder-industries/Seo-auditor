import type { Finding, Severity } from "../api";

const SEVERITY_ORDER: Severity[] = ["critical", "warning", "info"];

export function FindingsList({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) {
    return <p className="findings-empty">No findings — every check passed.</p>;
  }

  const sorted = [...findings].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );

  return (
    <ul className="findings-list">
      {sorted.map((finding, i) => (
        <li key={i} className={`finding finding--${finding.severity}`}>
          <span className="finding__severity">{finding.severity}</span>
          <div className="finding__body">
            <p className="finding__message">{finding.message}</p>
            <p className="finding__meta">
              {finding.category} · {finding.pluginName}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
