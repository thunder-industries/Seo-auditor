import Database, { type Database as DatabaseType } from "better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { AuditReport } from "@seo-auditor/reports";
import type { AuditRepository } from "../AuditRepository.js";

const SCHEMA_PATH = fileURLToPath(new URL("./schema.sql", import.meta.url));

interface AuditRow {
  id: string;
  target: string;
  created_at: string;
  overall_score: number;
  report_json: string;
}

export class SqliteAuditRepository implements AuditRepository {

  private db: DatabaseType;

  constructor(filename: string = "seo-auditor.db") {
    this.db = new Database(filename);
    this.db.exec(readFileSync(SCHEMA_PATH, "utf8"));
  }

  async save(report: AuditReport): Promise<string> {
    this.db.prepare(`
      INSERT INTO audits (id, target, created_at, overall_score, report_json)
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

  async getById(id: string): Promise<AuditReport | null> {
    const row = this.db
      .prepare("SELECT * FROM audits WHERE id = ?")
      .get(id) as AuditRow | undefined;

    return row ? (JSON.parse(row.report_json) as AuditReport) : null;
  }

  async listByTarget(target: string): Promise<AuditReport[]> {
    const rows = this.db
      .prepare("SELECT * FROM audits WHERE target = ? ORDER BY created_at DESC")
      .all(target) as AuditRow[];

    return rows.map(row => JSON.parse(row.report_json) as AuditReport);
  }

  close(): void {
    this.db.close();
  }

}
