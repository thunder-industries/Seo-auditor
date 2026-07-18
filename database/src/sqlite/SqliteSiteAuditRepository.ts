import Database, { type Database as DatabaseType } from "better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { SiteAuditReport } from "@seo-auditor/reports";
import type { SiteAuditRepository } from "../SiteAuditRepository.js";

const SCHEMA_PATH = fileURLToPath(new URL("./schema.sql", import.meta.url));

interface SiteAuditRow {
  id: string;
  target: string;
  created_at: string;
  overall_score: number;
  report_json: string;
}

export class SqliteSiteAuditRepository implements SiteAuditRepository {

  private db: DatabaseType;

  constructor(filename: string = "seo-auditor.db") {
    this.db = new Database(filename);
    this.db.exec(readFileSync(SCHEMA_PATH, "utf8"));
  }

  async save(report: SiteAuditReport): Promise<string> {
    this.db.prepare(`
      INSERT INTO site_audits (id, target, created_at, overall_score, report_json)
      VALUES (@id, @target, @created_at, @overall_score, @report_json)
      ON CONFLICT(id) DO UPDATE SET
        target = excluded.target,
        created_at = excluded.created_at,
        overall_score = excluded.overall_score,
        report_json = excluded.report_json
    `).run({
      id: report.id,
      target: report.target,
      created_at: report.createdAt,
      overall_score: report.score.overall,
      report_json: JSON.stringify(report)
    });

    return report.id;
  }

  async getById(id: string): Promise<SiteAuditReport | null> {
    const row = this.db
      .prepare("SELECT * FROM site_audits WHERE id = ?")
      .get(id) as SiteAuditRow | undefined;

    return row ? (JSON.parse(row.report_json) as SiteAuditReport) : null;
  }

  async listByTarget(target: string): Promise<SiteAuditReport[]> {
    const rows = this.db
      .prepare("SELECT * FROM site_audits WHERE target = ? ORDER BY created_at DESC")
      .all(target) as SiteAuditRow[];

    return rows.map(row => JSON.parse(row.report_json) as SiteAuditReport);
  }

  close(): void {
    this.db.close();
  }

}
