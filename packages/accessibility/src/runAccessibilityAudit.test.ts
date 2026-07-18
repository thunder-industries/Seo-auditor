import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { runAccessibilityAudit } from "./runAccessibilityAudit.js";

const FIXTURE_PAGES: Record<string, string> = {
  "/violation": `
    <html lang="en">
    <head><title>Violation Fixture</title></head>
    <body>
      <img src="x.png">
      <h1>Heading</h1>
    </body>
    </html>
  `,
  "/clean": `
    <html lang="en">
    <head><title>Clean Fixture</title></head>
    <body>
      <main>
        <h1>Heading</h1>
        <img src="x.png" alt="A descriptive alt text">
      </main>
    </body>
    </html>
  `
};

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    const path = (req.url || "/").split("?")[0];
    const body = FIXTURE_PAGES[path];
    if (!body) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, { "content-type": "text/html" });
    res.end(body);
  });
  await new Promise<void>(resolve => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://localhost:${port}`;
});

afterAll(() => {
  server.close();
});

describe("runAccessibilityAudit", () => {

  it("reports the missing-alt-text violation on a page with one", async () => {

    const result = await runAccessibilityAudit(`${baseUrl}/violation`);

    expect(result.violationCount).toBeGreaterThan(0);
    expect(result.findings.every(f => f.category === "accessibility")).toBe(true);
    expect(result.findings.some(f => f.details?.ruleId === "image-alt")).toBe(true);
    expect(result.findings.find(f => f.details?.ruleId === "image-alt")?.severity).toBe("critical");

  }, 30000);

  it("reports no image-alt violation on a page with proper alt text and landmarks", async () => {

    const result = await runAccessibilityAudit(`${baseUrl}/clean`);

    expect(result.findings.some(f => f.details?.ruleId === "image-alt")).toBe(false);

  }, 30000);

});
