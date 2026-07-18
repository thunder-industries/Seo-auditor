import type { AuditPlugin } from "@seo-auditor/plugins";
import { securityHeadersPlugin } from "./plugins/securityHeaders.js";
import { sslPlugin } from "./plugins/ssl.js";

export const securityPlugins: AuditPlugin[] = [securityHeadersPlugin, sslPlugin];

export { securityHeadersPlugin, sslPlugin };
