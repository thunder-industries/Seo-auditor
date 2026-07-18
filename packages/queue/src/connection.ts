import { Redis } from "ioredis";

export const QUEUE_NAME = "site-audits";

// Namespaces every key this queue touches so it can share a Redis instance
// with unrelated data (this sandbox's Redis already had keys from something
// else) without ever colliding or requiring a destructive FLUSHALL cleanup.
export const QUEUE_PREFIX = "seo-auditor";

export function createConnection(): Redis {
  return new Redis({
    host: process.env.REDIS_HOST ?? "localhost",
    port: Number(process.env.REDIS_PORT ?? 6379),
    // Required by BullMQ's Worker — it throws at construction time if this
    // isn't set to null on the connection it's given.
    maxRetriesPerRequest: null
  });
}
