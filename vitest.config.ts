import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // A few integration tests (apps/api/src/server.test.ts) run the full
    // crawl -> plugins pipeline against a local fixture server, including
    // plugins with their own network timeouts (DNS, robots.txt). The
    // default 5s per-test timeout is too tight for that; unit tests finish
    // in milliseconds regardless, so this only matters for the slow ones.
    testTimeout: 20000
  }
});
