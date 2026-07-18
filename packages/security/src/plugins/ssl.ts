import { connect, type TLSSocket } from "node:tls";
import type { AuditContext, AuditPlugin, Finding } from "@seo-auditor/plugins";

const TIMEOUT_MS = 10000;
const EXPIRY_WARNING_DAYS = 14;

interface CertInfo {
  issuer: string;
  validFrom: string;
  validTo: string;
  daysRemaining: number;
}

function getCertificate(hostname: string): Promise<CertInfo | null> {
  return new Promise(resolve => {

    let socket: TLSSocket;

    const finish = (result: CertInfo | null) => {
      socket?.destroy();
      resolve(result);
    };

    socket = connect(
      { host: hostname, port: 443, servername: hostname, timeout: TIMEOUT_MS },
      () => {

        const cert = socket.getPeerCertificate();

        if (!cert || !cert.valid_to) {
          finish(null);
          return;
        }

        const validTo = new Date(cert.valid_to);
        const daysRemaining = Math.round((validTo.getTime() - Date.now()) / 86_400_000);

        const issuerOrg = cert.issuer?.O;

        finish({
          issuer: (Array.isArray(issuerOrg) ? issuerOrg[0] : issuerOrg) || "Unknown",
          validFrom: cert.valid_from,
          validTo: cert.valid_to,
          daysRemaining
        });

      }
    );

    socket.on("error", () => finish(null));
    socket.on("timeout", () => finish(null));

  });
}

/** Harvested from index.js's checkSSL. */
export const sslPlugin: AuditPlugin = {
  name: "ssl-certificate",
  version: "0.1.0",
  category: "security",
  scope: "domain",

  async run(_page, context: AuditContext): Promise<Finding[]> {

    if (!context.crawled.https) {
      return [{
        pluginName: "ssl-certificate",
        category: "security",
        severity: "critical",
        message: "Site is not served over HTTPS."
      }];
    }

    const hostname = new URL(context.url).hostname;
    const cert = await getCertificate(hostname);

    if (!cert) {
      return [{
        pluginName: "ssl-certificate",
        category: "security",
        severity: "warning",
        message: "Could not retrieve SSL certificate information."
      }];
    }

    if (cert.daysRemaining <= EXPIRY_WARNING_DAYS) {
      return [{
        pluginName: "ssl-certificate",
        category: "security",
        severity: cert.daysRemaining <= 0 ? "critical" : "warning",
        message: `SSL certificate expires in ${cert.daysRemaining} days.`,
        details: cert as unknown as Record<string, unknown>
      }];
    }

    return [{
      pluginName: "ssl-certificate",
      category: "security",
      severity: "info",
      message: `SSL certificate valid for ${cert.daysRemaining} more days.`,
      details: cert as unknown as Record<string, unknown>
    }];

  }
};
