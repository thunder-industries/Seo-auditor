import { Queue } from "bullmq";
import { SqliteAuditRepository, SqliteSiteAuditRepository } from "@seo-auditor/database";
import { QUEUE_NAME, QUEUE_PREFIX, createConnection, type SiteAuditJobData } from "@seo-auditor/queue";
import { buildServer } from "./server.js";

const databasePath = process.env.DATABASE_PATH ?? "seo-auditor.db";
const repository = new SqliteAuditRepository(databasePath);
const siteRepository = new SqliteSiteAuditRepository(databasePath);

const siteAuditQueue = new Queue<SiteAuditJobData>(QUEUE_NAME, {
  connection: createConnection(),
  prefix: QUEUE_PREFIX
});

const app = buildServer(repository, siteRepository, siteAuditQueue);

const port = Number(process.env.PORT ?? 4000);

app.listen({ port, host: "0.0.0.0" }).then(() => {
  console.log(`SEO Auditor API listening on port ${port}`);
});
