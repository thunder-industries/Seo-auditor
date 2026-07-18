import type { Job } from "bullmq";
import { PluginRegistry } from "@seo-auditor/plugins";
import { technicalPlugins } from "@seo-auditor/technical";
import { securityPlugins } from "@seo-auditor/security";
import { runSiteAudit } from "@seo-auditor/orchestration";
import type { SiteAuditRepository } from "@seo-auditor/database";
import type { SiteAuditJobData } from "@seo-auditor/queue";

/**
 * Builds the job-processing function for a given repository. A factory
 * (rather than a module-level singleton) so tests can pass in a throwaway
 * repository, mirroring apps/api's buildServer(repository) pattern.
 */
export function createProcessor(repository: SiteAuditRepository) {

  const registry = new PluginRegistry();
  registry.registerAll([...technicalPlugins, ...securityPlugins]);

  return async function processSiteAuditJob(job: Job<SiteAuditJobData>): Promise<void> {

    const { id, url, options } = job.data;

    // The exact same function apps/api's synchronous /audits path is built
    // on (Phase 1/2), given the job's id so the persisted report's id
    // matches the id the client received when the job was enqueued.
    await runSiteAudit(url, registry, repository, options, id);

  };

}
