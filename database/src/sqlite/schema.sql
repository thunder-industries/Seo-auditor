-- Phase 1 SQLite schema. Kept intentionally close to standard SQL so the
-- eventual Postgres migration is close to a straight port:
--   - TEXT id (SQLite has no native UUID type; Postgres version would use
--     `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`).
--   - created_at stored as ISO-8601 TEXT here; Postgres version would use
--     `TIMESTAMPTZ`.
--   - report_json stores the full AuditReport as JSON text here; Postgres
--     version would use the native `JSONB` type for indexable queries.
CREATE TABLE IF NOT EXISTS audits (
  id TEXT PRIMARY KEY,
  target TEXT NOT NULL,
  created_at TEXT NOT NULL,
  overall_score INTEGER NOT NULL,
  report_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audits_target ON audits (target);

-- Phase 2: multi-page site audits. Same JSON-blob storage pattern as
-- `audits` above — the full SiteAuditReport (including each member page's
-- own AuditReport) is stored as report_json; indexed columns exist only
-- for the query patterns the repository actually needs.
CREATE TABLE IF NOT EXISTS site_audits (
  id TEXT PRIMARY KEY,
  target TEXT NOT NULL,
  created_at TEXT NOT NULL,
  overall_score INTEGER NOT NULL,
  report_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_site_audits_target ON site_audits (target);
