import { launchChromium } from "@seo-auditor/browser";
import type { RenderedPage } from "./types.js";

const NAVIGATION_TIMEOUT_MS = 20000;

/**
 * Renders a URL in a real browser and returns the post-JS-execution HTML
 * plus any console/page errors seen while loading. One browser launched
 * and closed per call — simple and correct; reusing a browser instance
 * across multiple renders is a viable later optimization if this becomes
 * a throughput bottleneck (not needed for the current opt-in, single-page
 * use in runAudit).
 */
export async function renderPage(url: string): Promise<RenderedPage> {

  const browser = await launchChromium();

  try {

    const page = await browser.newPage();
    const consoleErrors: string[] = [];

    page.on("console", msg => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    page.on("pageerror", err => {
      consoleErrors.push(err.message);
    });

    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: NAVIGATION_TIMEOUT_MS
    });

    const html = await page.content();

    return { url, html, consoleErrors };

  } finally {

    await browser.close();

  }

}
