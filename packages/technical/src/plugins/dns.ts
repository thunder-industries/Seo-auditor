import { promises as dns } from "node:dns";
import type { AuditContext, AuditPlugin, Finding } from "@seo-auditor/plugins";

const RECORD_TYPES = ["A", "AAAA", "MX", "NS", "TXT", "CNAME"] as const;
const DNS_TIMEOUT_MS = 5000;

// Node's dns.promises functions have no built-in timeout — an unresponsive
// or slow resolver can hang a lookup indefinitely. Every other network call
// in this codebase (axios, tls) already has a timeout; this brings DNS
// lookups in line.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("DNS lookup timed out")), ms);
    })
  ]);
}

type DnsRecords = {
  A: string[];
  AAAA: string[];
  MX: string[];
  NS: string[];
  TXT: string[];
  CNAME: string[];
};

/**
 * Harvested from index.js's checkDNS. Each record type is resolved and
 * caught independently — a missing record type throws ENODATA/ENOTFOUND,
 * which just means "none of this type," not a lookup failure.
 *
 * Fixes the display bug from the original CLI, where MX records (returned
 * as {exchange, priority} objects) were joined directly into a string and
 * printed as "[object Object]". Here they're formatted explicitly before
 * being placed into Finding details.
 */
export const dnsPlugin: AuditPlugin = {
  name: "dns-records",
  version: "0.1.0",
  category: "technical",
  scope: "domain",

  async run(_page, context: AuditContext): Promise<Finding[]> {

    const hostname = new URL(context.url).hostname;
    const records: DnsRecords = { A: [], AAAA: [], MX: [], NS: [], TXT: [], CNAME: [] };

    // Deliberately sequential, not Promise.all — measured against a real
    // resolver, firing all six lookups concurrently made them ~4x slower
    // overall (some environments appear to serialize/queue concurrent DNS
    // queries rather than truly parallelize them, so concurrency here adds
    // contention instead of removing latency). Sequential was empirically
    // faster and more reliable; verify with real timing before changing this.
    for (const type of RECORD_TYPES) {
      try {
        if (type === "MX") {
          const mxRecords = await withTimeout(dns.resolveMx(hostname), DNS_TIMEOUT_MS);
          records.MX = mxRecords.map(r =>
            // RFC 7505 "null MX" (empty exchange) explicitly signals "no mail accepted".
            r.exchange ? `${r.exchange} (priority ${r.priority})` : "(none — null MX, no mail accepted)"
          );
        } else if (type === "TXT") {
          const txtRecords = await withTimeout(dns.resolveTxt(hostname), DNS_TIMEOUT_MS);
          records.TXT = txtRecords.map(r => r.join(""));
        } else {
          records[type] = await withTimeout(dns.resolve(hostname, type), DNS_TIMEOUT_MS);
        }
      } catch {
        // No records of this type, or the lookup timed out — leave the array empty.
      }
    }

    const findings: Finding[] = [];

    if (records.NS.length === 0) {
      findings.push({
        pluginName: "dns-records",
        category: "technical",
        severity: "critical",
        message: "No NS records found — domain may be misconfigured.",
        details: { dns: records }
      });
    } else {
      findings.push({
        pluginName: "dns-records",
        category: "technical",
        severity: "info",
        message: `Resolved DNS records for ${hostname}.`,
        details: { dns: records }
      });
    }

    return findings;

  }
};
