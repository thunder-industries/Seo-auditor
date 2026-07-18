import type { ScoreResult } from "@seo-auditor/scoring";

function scoreTier(score: number): "good" | "ok" | "bad" {
  if (score >= 90) return "good";
  if (score >= 50) return "ok";
  return "bad";
}

export function ScoreBadge({ score }: { score: number }) {
  return <span className={`score-badge score-badge--${scoreTier(score)}`}>{score}</span>;
}

export function ScoreBreakdown({ result }: { result: ScoreResult }) {
  const categories = Object.entries(result.byCategory);

  return (
    <div className="score-breakdown">
      <div className="score-breakdown__overall">
        <ScoreBadge score={result.overall} />
        <span className="score-breakdown__label">Overall score</span>
      </div>
      {categories.length > 0 && (
        <ul className="score-breakdown__categories">
          {categories.map(([category, score]) => (
            <li key={category}>
              <span className="score-breakdown__category-name">{category}</span>
              <div className="score-bar">
                <div
                  className={`score-bar__fill score-bar__fill--${scoreTier(score)}`}
                  style={{ width: `${score}%` }}
                />
              </div>
              <span className="score-breakdown__category-value">{score}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
