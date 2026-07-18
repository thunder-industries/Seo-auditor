import { chromium, type Browser } from "playwright-core";

// This sandbox has no internet access to Playwright's own browser CDN, but
// does have a system-installed Chromium — playwright-core (unlike the full
// playwright package) never tries to download its own browser, so pointing
// it at the system one works. Not a portable default: a real deployment
// either sets this env var or installs Playwright's browsers where CDN
// access exists.
const EXECUTABLE_PATH = process.env.CHROMIUM_EXECUTABLE_PATH ?? "/usr/bin/chromium";

/**
 * Launches the system Chromium via playwright-core. Shared by every module
 * that needs a real browser (JS rendering, Lighthouse, axe-core) so the
 * executable-path/headless/sandbox settings live in one place.
 */
export async function launchChromium(extraArgs: string[] = []): Promise<Browser> {
  return chromium.launch({
    executablePath: EXECUTABLE_PATH,
    headless: true,
    args: ["--no-sandbox", ...extraArgs]
  });
}
