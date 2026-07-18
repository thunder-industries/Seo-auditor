import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { renderPage } from "./renderPage.js";

const STATIC_PAGE = `
  <html><head><title>Static Page</title></head>
  <body><h1>Static content, no JS needed</h1></body></html>
`;

const JS_HEAVY_PAGE = `
  <html><head><title>Loading...</title></head>
  <body>
    <div id="app"></div>
    <script>
      document.title = "Rendered by JS";
      document.getElementById("app").innerHTML = "<h1>Injected by JavaScript</h1>";
    </script>
  </body></html>
`;

const CONSOLE_ERROR_PAGE = `
  <html><head><title>Errors</title></head>
  <body>
    <script>
      console.error("Something broke");
    </script>
  </body></html>
`;

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    const path = (req.url || "/").split("?")[0];
    const body =
      path === "/js-heavy" ? JS_HEAVY_PAGE :
      path === "/console-error" ? CONSOLE_ERROR_PAGE :
      STATIC_PAGE;

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

describe("renderPage", () => {

  it("returns HTML containing content injected by JavaScript after page load", async () => {

    const rendered = await renderPage(`${baseUrl}/js-heavy`);

    expect(rendered.html).toContain("Injected by JavaScript");
    expect(rendered.html).toContain("Rendered by JS"); // the JS-updated <title>
    expect(rendered.consoleErrors).toHaveLength(0);

  }, 30000);

  it("captures console.error calls made while the page loads", async () => {

    const rendered = await renderPage(`${baseUrl}/console-error`);

    expect(rendered.consoleErrors).toContain("Something broke");

  }, 30000);

  it("returns the static page's HTML unchanged (no JS involved)", async () => {

    const rendered = await renderPage(baseUrl);

    expect(rendered.html).toContain("Static content, no JS needed");
    expect(rendered.consoleErrors).toHaveLength(0);

  }, 30000);

});
