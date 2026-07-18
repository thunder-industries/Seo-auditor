import * as cheerio from "cheerio";
import type { ParsedPage } from "./types.js";

const ASSET_EXTENSIONS =
  /\.(png|jpe?g|gif|webp|svg|ico|bmp|css|js|json|woff2?|ttf)$/i;

const EMAIL_REGEX =
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

const PHONE_REGEX =
  /(?=[\d\s\-()]{8,}\d)(\+?\d[\d\s\-()]*[\-\s()][\d\s\-()]*\d)/g;

const NON_PAGE_LINK_PREFIXES = ["mailto:", "tel:", "javascript:", "#"];

/**
 * Parses fetched HTML into structured page data. Harvested from the original
 * index.js `parseHTML`/`extractEmails`/`extractPhones`, including the fix for
 * the internal/external link misclassification (mailto/tel/javascript/#-anchor
 * links no longer counted as internal; classification uses `new URL(href, url)`
 * instead of a fragile hostname substring match, guarded against malformed hrefs).
 */
export function parseHtml(url: string, html: string): ParsedPage {

  const $ = cheerio.load(html);
  const targetHostname = new URL(url).hostname;

  const title = $("title").text().trim();
  const description = $('meta[name="description"]').attr("content") || "";
  const language = $("html").attr("lang") || "Unknown";
  const canonical = $('link[rel="canonical"]').attr("href") || null;
  const metaGenerator = $('meta[name="generator"]').attr("content") || null;

  const headings: string[] = [];
  $("h1").each((_, el) => { headings.push($(el).text().trim()); });

  const images: string[] = [];
  $("img").each((_, el) => {
    const src = $(el).attr("src");
    if (src) images.push(src);
  });

  const scripts: string[] = [];
  $("script").each((_, el) => {
    const src = $(el).attr("src");
    if (src) scripts.push(src);
  });

  const stylesheets: string[] = [];
  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) stylesheets.push(href);
  });

  const links: string[] = [];
  const internalLinks: string[] = [];
  const externalLinks: string[] = [];

  $("a").each((_, el) => {

    const href = $(el).attr("href");

    if (!href) return;
    if (NON_PAGE_LINK_PREFIXES.some(prefix => href.startsWith(prefix))) return;

    links.push(href);

    try {
      const resolved = new URL(href, url);
      if (resolved.hostname === targetHostname) {
        internalLinks.push(href);
      } else {
        externalLinks.push(href);
      }
    } catch {
      internalLinks.push(href);
    }

  });

  const foundEmails = html.match(EMAIL_REGEX) || [];
  const emails = [...new Set(
    foundEmails.filter(email => !ASSET_EXTENSIONS.test(email))
  )];

  const phones = [...new Set(html.match(PHONE_REGEX) || [])];

  return {
    url,
    title,
    description,
    language,
    canonical,
    metaGenerator,
    headings,
    images,
    scripts,
    stylesheets,
    links,
    internalLinks,
    externalLinks,
    emails,
    phones
  };

}
