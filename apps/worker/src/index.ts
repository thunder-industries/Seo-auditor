import { Worker } from "bullmq";
import { SqliteSiteAuditRepository } from "@seo-auditor/database";
import { QUEUE_NAME, QUEUE_PREFIX, createConnection } from "@seo-auditor/queue";
import { createProcessor } from "./processor.js";

const repository = new SqliteSiteAuditRepository(process.env.DATABASE_PATH ?? "seo-auditor.db");
const processor = createProcessor(repository);

const worker = new Worker(QUEUE_NAME, processor, {
  connection: createConnection(),
  prefix: QUEUE_PREFIX
});

worker.on("completed", job => {
  console.log(`Site audit ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`Site audit ${job?.id} failed:`, err.message);
});

console.log("SEO Auditor worker listening for site-audit jobs");
