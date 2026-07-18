import type { AuditReport } from "@seo-auditor/reports";

/**
 * Persistence boundary for audit reports. Phase 1 ships a SQLite
 * implementation (see sqlite/SqliteAuditRepository.ts) because this sandbox
 * has no Docker/Postgres available; a PostgresAuditRepository implementing
 * the same interface can be swapped in later (via dependency injection at
 * the app's composition root) with no changes to caller code.
 */
export interface AuditRepository {
  save(report: AuditReport): Promise<string>;
  getById(id: string): Promise<AuditReport | null>;
  listByTarget(target: string): Promise<AuditReport[]>;
}
