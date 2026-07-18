import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import type { Queue } from "bullmq";
import { PluginRegistry } from "@seo-auditor/plugins";
import { technicalPlugins } from "@seo-auditor/technical";
import { securityPlugins } from "@seo-auditor/security";
import type { AuditRepository, SiteAuditRepository } from "@seo-auditor/database";
import { runAudit } from "@seo-auditor/orchestration";
import type { SiteAuditJobData } from "@seo-auditor/queue";

const createAuditSchema = z.object({
  url: z.string().min(1),
  renderJs: z.boolean().optional(),
  checkPerformance: z.boolean().optional(),
  checkAccessibility: z.boolean().optional()
});

const createSiteAuditSchema = z.object({
  url: z.string().min(1),
  maxPages: z.number().int().positive().max(100).optional(),
  maxDepth: z.number().int().positive().max(10).optional()
});

// Maps BullMQ's job states onto the small vocabulary this API exposes.
function toJobStatus(state: string): "queued" | "active" | "failed" {
  if (state === "active") return "active";
  if (state === "failed") return "failed";
  return "queued"; // waiting, waiting-children, prioritized, delayed
}

export function buildServer(
  repository: AuditRepository,
  siteRepository: SiteAuditRepository,
  siteAuditQueue: Queue<SiteAuditJobData>
): FastifyInstance {

  const registry = new PluginRegistry();
  registry.registerAll([...technicalPlugins, ...securityPlugins]);

  const app = Fastify({ logger: false });

  app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? true
  });

  app.post("/audits", async (request, reply) => {

    const parsed = createAuditSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request", details: parsed.error.flatten() });
    }

    try {
      const { url, ...options } = parsed.data;
      const report = await runAudit(url, registry, repository, options);
      return reply.status(201).send(report);
    } catch (err) {
      return reply.status(502).send({ error: "Audit failed", message: (err as Error).message });
    }

  });

  app.get("/audits/:id", async (request, reply) => {

    const { id } = request.params as { id: string };
    const report = await repository.getById(id);

    if (!report) return reply.status(404).send({ error: "Not found" });
    return reply.send(report);

  });

  app.get("/audits", async (request, reply) => {

    const { target } = request.query as { target?: string };

    if (!target) return reply.status(400).send({ error: "target query param is required" });

    return reply.send(await repository.listByTarget(target));

  });

  // Enqueues a crawl of up to maxPages same-domain pages instead of running
  // it inline — a full crawl can take up to ~maxPages x 15s, which used to
  // mean the HTTP request itself stayed open that whole time (Phase 2).
  // apps/worker processes the job in a separate process; poll
  // GET /site-audits/:id for status.
  app.post("/site-audits", async (request, reply) => {

    const parsed = createSiteAuditSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const { url, ...options } = parsed.data;
    const id = randomUUID();

    await siteAuditQueue.add(
      "site-audit",
      { id, url, options },
      { jobId: id }
    );

    return reply.status(202).send({ id, status: "queued" });

  });

  app.get("/site-audits/:id", async (request, reply) => {

    const { id } = request.params as { id: string };

    const report = await siteRepository.getById(id);

    if (report) {
      return reply.send({ ...report, status: "completed" });
    }

    const job = await siteAuditQueue.getJob(id);

    if (!job) {
      return reply.status(404).send({ error: "Not found" });
    }

    const state = await job.getState();
    const status = toJobStatus(state);

    if (status === "failed") {
      return reply.send({ id, status, error: job.failedReason });
    }

    return reply.send({ id, status });

  });

  return app;

}
