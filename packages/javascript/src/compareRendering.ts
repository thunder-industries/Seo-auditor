import * as cheerio from "cheerio";
import type { ParsedPage } from "@seo-auditor/parser";
import type { Finding } from "@seo-auditor/plugins";

const CONTENT_RATIO_THRESHOLD = 1.5;
const CONTENT_MIN_DELTA_CHARS = 200;
const MAX_CONSOLE_ERRORS_SHOWN = 3;

export interface CompareRenderingInput {
  rawPage: ParsedPage;
  rawHtml: string;
  renderedPage: ParsedPage;
  renderedHtml: string;
  consoleErrors: string[];
}

function bodyTextLength(html: string): number {
  return cheerio.load(html)("body").text().trim().length;
}

/**
 * Heuristic, not a scientific hydration-diff algorithm: flags content or
 * metadata that's only present after JavaScript runs, which crawlers that
 * don't execute JS won't see. False positives are possible on pages with
 * legitimately dynamic-but-non-SEO-relevant content (ads, widgets) — these
 * are signals to investigate, not certainties.
 */
export function compareRendering(input: CompareRenderingInput): Finding[] {

  const { rawPage, rawHtml, renderedPage, renderedHtml, consoleErrors } = input;
  const findings: Finding[] = [];

  if (!rawPage.title.trim() && renderedPage.title.trim()) {
    findings.push({
      pluginName: "js-rendering",
      category: "javascript",
      severity: "warning",
      message: "Title is only available after JavaScript execution — crawlers that don't render JS may see a blank title.",
      details: { renderedTitle: renderedPage.title }
    });
  }

  if (!rawPage.description.trim() && renderedPage.description.trim()) {
    findings.push({
      pluginName: "js-rendering",
      category: "javascript",
      severity: "info",
      message: "Meta description is only available after JavaScript execution.",
      details: { renderedDescription: renderedPage.description }
    });
  }

  if (renderedPage.headings.length > rawPage.headings.length) {
    findings.push({
      pluginName: "js-rendering",
      category: "javascript",
      severity: "warning",
      message: `${renderedPage.headings.length - rawPage.headings.length} heading(s) only appear after JavaScript rendering.`,
      details: { rawHeadings: rawPage.headings, renderedHeadings: renderedPage.headings }
    });
  }

  const rawTextLength = bodyTextLength(rawHtml);
  const renderedTextLength = bodyTextLength(renderedHtml);
  const delta = renderedTextLength - rawTextLength;

  if (
    delta >= CONTENT_MIN_DELTA_CHARS &&
    (rawTextLength === 0 || renderedTextLength / rawTextLength >= CONTENT_RATIO_THRESHOLD)
  ) {
    findings.push({
      pluginName: "js-rendering",
      category: "javascript",
      severity: "warning",
      message: `Significant content (~${delta} characters) only appears after JavaScript rendering — may not be visible to crawlers that don't execute JS.`,
      details: { rawTextLength, renderedTextLength }
    });
  }

  if (consoleErrors.length > 0) {
    findings.push({
      pluginName: "js-rendering",
      category: "javascript",
      severity: "warning",
      message: `${consoleErrors.length} console error(s) occurred while rendering the page: ${consoleErrors.slice(0, MAX_CONSOLE_ERRORS_SHOWN).join(" | ")}`,
      details: { consoleErrors }
    });
  }

  return findings;

}
