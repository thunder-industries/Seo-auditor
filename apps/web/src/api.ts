import type { AuditReport, SiteAuditReport } from "@seo-auditor/reports";

export type { AuditReport, SiteAuditReport };
export type { Finding, Severity } from "@seo-auditor/plugins";

export interface AuditOptions {
  renderJs?: boolean;
  checkPerformance?: boolean;
  checkAccessibility?: boolean;
}

export interface SiteAuditOptions {
  maxPages?: number;
  maxDepth?: number;
}

export type SiteAuditStatus =
  | { id: string; status: "queued" | "active" }
  | { id: string; status: "failed"; error?: string }
  | (SiteAuditReport & { status: "completed" });

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.message ?? body.error ?? response.statusText, response.status);
  }

  return response.json() as Promise<T>;
}

export function runPageAudit(url: string, options: AuditOptions): Promise<AuditReport> {
  return request<AuditReport>("/audits", {
    method: "POST",
    body: JSON.stringify({ url, ...options })
  });
}

export function startSiteAudit(url: string, options: SiteAuditOptions): Promise<{ id: string; status: string }> {
  return request<{ id: string; status: string }>("/site-audits", {
    method: "POST",
    body: JSON.stringify({ url, ...options })
  });
}

export function getSiteAuditStatus(id: string): Promise<SiteAuditStatus> {
  return request<SiteAuditStatus>(`/site-audits/${id}`);
}
