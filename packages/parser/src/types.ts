export interface ParsedPage {
  url: string;
  title: string;
  description: string;
  language: string;
  canonical: string | null;
  metaGenerator: string | null;
  headings: string[];
  images: string[];
  scripts: string[];
  stylesheets: string[];
  links: string[];
  internalLinks: string[];
  externalLinks: string[];
  emails: string[];
  phones: string[];
}
