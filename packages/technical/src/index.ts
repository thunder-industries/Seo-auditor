import type { AuditPlugin } from "@seo-auditor/plugins";
import { titleTagPlugin } from "./plugins/titleTag.js";
import { metaDescriptionPlugin } from "./plugins/metaDescription.js";
import { headingStructurePlugin } from "./plugins/headingStructure.js";
import { canonicalPlugin } from "./plugins/canonical.js";
import { robotsSitemapPlugin } from "./plugins/robotsSitemap.js";
import { dnsPlugin } from "./plugins/dns.js";

export const technicalPlugins: AuditPlugin[] = [
  titleTagPlugin,
  metaDescriptionPlugin,
  headingStructurePlugin,
  canonicalPlugin,
  robotsSitemapPlugin,
  dnsPlugin
];

export {
  titleTagPlugin,
  metaDescriptionPlugin,
  headingStructurePlugin,
  canonicalPlugin,
  robotsSitemapPlugin,
  dnsPlugin
};
