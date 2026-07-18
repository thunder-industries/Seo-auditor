import type { SiteAuditReport } from "@seo-auditor/reports";

export interface SiteAuditRepository {
  save(report: SiteAuditReport): Promise<string>;
  getById(id: string): Promise<SiteAuditReport | null>;
  listByTarget(target: string): Promise<SiteAuditReport[]>;
}
