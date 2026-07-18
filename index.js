
const axios = require("axios");
const cheerio = require("cheerio");
const chalk = require("chalk");
const ora = require("ora");
const dns = require("dns").promises;
const tls = require("tls");
const fs = require("fs");
const crypto = require("crypto");
const { performance } = require("perf_hooks");

//===========================================================
// CLI ARGS
//===========================================================

const rawArgs = process.argv.slice(2);
const flags = rawArgs.filter(a => a.startsWith("--"));
const positional = rawArgs.filter(a => !a.startsWith("--"));

function normalizeTarget(url) {
    if (!/^https?:\/\//i.test(url))
        return "https://" + url;
    return url;
}

const TARGET = normalizeTarget(positional[0] || "https://github.com");
const TARGET_HOSTNAME = new URL(TARGET).hostname;

const JSON_OUTPUT = flags.includes("--json");

const watchFlag = flags.find(f => f.startsWith("--watch"));
const WATCH_ENABLED = !!watchFlag;
const WATCH_INTERVAL_MS = watchFlag && watchFlag.includes("=")
    ? (parseInt(watchFlag.split("=")[1], 10) || 300) * 1000
    : 300000;

//===========================================================
// REPORT FACTORY
//===========================================================

function freshReport() {
    return {
        target: TARGET,
        status: "",
        responseTime: "",
        server: "",
        contentType: "",
        https: false,
        htmlSize: 0,
        headers: {},
        contentHash: "",

        title: "",
        description: "",
        language: "",

        links: [],
        internalLinks: [],
        externalLinks: [],
        images: [],
        scripts: [],
        stylesheets: [],
        headings: [],

        emails: [],
        phones: [],

        robots: false,
        sitemap: false,

        dns: {},
        ip: null,
        geo: null,

        ssl: null,

        securityHeaders: {},

        brokenLinks: [],

        osGuess: "",
        techStack: []
    };
}

//===========================================================
// UI
//===========================================================

function line() {
    console.log(chalk.gray("===================================================="));
}

function section(title) {
    console.log();
    console.log(chalk.cyan.bold(title));
    console.log(chalk.gray("--------------------------------------------"));
}

function success(msg) {
    console.log(chalk.green("✓ " + msg));
}

function warning(msg) {
    console.log(chalk.yellow("! " + msg));
}

function error(msg) {
    console.log(chalk.red("✗ " + msg));
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

//===========================================================
// FETCH PAGE
//===========================================================

async function fetchPage(report, url) {

    const spinner = ora("Connecting...").start();

    try {

        const start = performance.now();

        const response = await axios.get(url, {

            timeout: 15000,

            headers: {

                "User-Agent":
                    "SenderAuditor/1.0 (+https://your-domain.com)"

            }

        });

        const end = performance.now();

        spinner.succeed("Connected");

        report.status = response.status;
        report.responseTime = `${Math.round(end - start)} ms`;

        report.server =
            response.headers.server || "Unknown";

        report.contentType =
            response.headers["content-type"] || "Unknown";

        report.https = url.startsWith("https://");

        report.headers = response.headers;

        const html =
            typeof response.data === "string"
                ? response.data
                : JSON.stringify(response.data);

        report.htmlSize =
            Buffer.byteLength(html, "utf8");

        report.contentHash =
            crypto.createHash("sha256").update(html).digest("hex").slice(0, 12);

        return html;

    } catch (err) {

        spinner.fail("Connection failed");

        throw err;

    }

}

//===========================================================
// PARSE HTML
//===========================================================

function parseHTML(report, html) {

    const $ = cheerio.load(html);

    report.title = $("title").text().trim();

    report.description =
        $('meta[name="description"]').attr("content") || "";

    report.language =
        $("html").attr("lang") || "Unknown";

    $("h1").each((i, el) => {

        report.headings.push($(el).text().trim());

    });

    $("img").each((i, el) => {

        const src = $(el).attr("src");

        if (src)
            report.images.push(src);

    });

    $("script").each((i, el) => {

        const src = $(el).attr("src");

        if (src)
            report.scripts.push(src);

    });

    $('link[rel="stylesheet"]').each((i, el) => {

        const href = $(el).attr("href");

        if (href)
            report.stylesheets.push(href);

    });

    $("a").each((i, el) => {

        const href = $(el).attr("href");

        if (!href)
            return;

        if (
            href.startsWith("mailto:") ||
            href.startsWith("tel:") ||
            href.startsWith("javascript:") ||
            href.startsWith("#")
        )
            return;

        report.links.push(href);

        try {

            const resolved = new URL(href, TARGET);

            if (resolved.hostname === TARGET_HOSTNAME) {
                report.internalLinks.push(href);
            } else {
                report.externalLinks.push(href);
            }

        } catch {

            report.internalLinks.push(href);

        }

    });

}

//===========================================================
// EXTRACT EMAILS
//===========================================================

function extractEmails(report, html) {

    const regex =
        /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

    const found = html.match(regex);

    if (!found)
        return;

    const assetExtensions =
        /\.(png|jpe?g|gif|webp|svg|ico|bmp|css|js|json|woff2?|ttf)$/i;

    const filtered = found.filter(
        email => !assetExtensions.test(email)
    );

    report.emails = [...new Set(filtered)];

}

//===========================================================
// EXTRACT PHONES
//===========================================================

function extractPhones(report, html) {

    const regex =
        /(?=[\d\s\-()]{8,}\d)(\+?\d[\d\s\-()]*[\-\s()][\d\s\-()]*\d)/g;

    const found = html.match(regex);

    if (!found)
        return;

    report.phones = [...new Set(found)];

}

//===========================================================
// CHECK ROBOTS
//===========================================================

async function checkRobots(report) {

    try {

        const url =
            new URL("/robots.txt", TARGET).href;

        const response = await axios.get(url, { timeout: 15000 });

        report.robots =
            response.status === 200;

    } catch {

        report.robots = false;

    }

}

//===========================================================
// CHECK SITEMAP
//===========================================================

async function checkSitemap(report) {

    try {

        const url =
            new URL("/sitemap.xml", TARGET).href;

        const response = await axios.get(url, { timeout: 15000 });

        report.sitemap =
            response.status === 200;

    } catch {

        report.sitemap = false;

    }

}

//===========================================================
// DNS RECORDS + IP
//===========================================================

async function checkDNS(report) {

    const recordTypes = ["A", "AAAA", "MX", "NS", "TXT", "CNAME"];

    for (const type of recordTypes) {

        try {

            const records = await dns.resolve(TARGET_HOSTNAME, type);

            report.dns[type] =
                type === "TXT"
                    ? records.map(r => r.join(""))
                    : records;

        } catch {

            report.dns[type] = [];

        }

    }

    report.ip =
        (report.dns.A && report.dns.A[0]) || null;

}

//===========================================================
// SSL CERTIFICATE
//===========================================================

function checkSSL(report) {

    return new Promise(resolve => {

        if (!TARGET.startsWith("https://")) {
            report.ssl = null;
            return resolve();
        }

        const socket = tls.connect(
            {
                host: TARGET_HOSTNAME,
                port: 443,
                servername: TARGET_HOSTNAME,
                timeout: 10000
            },
            () => {

                const cert = socket.getPeerCertificate();

                if (cert && cert.valid_to) {

                    const validTo = new Date(cert.valid_to);
                    const daysRemaining =
                        Math.round((validTo - Date.now()) / 86400000);

                    report.ssl = {
                        issuer: (cert.issuer && cert.issuer.O) || "Unknown",
                        validFrom: cert.valid_from,
                        validTo: cert.valid_to,
                        daysRemaining
                    };

                } else {

                    report.ssl = null;

                }

                socket.end();
                resolve();

            }
        );

        socket.on("error", () => {
            report.ssl = null;
            resolve();
        });

        socket.on("timeout", () => {
            report.ssl = null;
            socket.destroy();
            resolve();
        });

    });

}

//===========================================================
// SECURITY HEADERS AUDIT
//===========================================================

function auditSecurityHeaders(report) {

    const checks = {
        "Strict-Transport-Security": "strict-transport-security",
        "Content-Security-Policy": "content-security-policy",
        "X-Frame-Options": "x-frame-options",
        "X-Content-Type-Options": "x-content-type-options",
        "Referrer-Policy": "referrer-policy",
        "Permissions-Policy": "permissions-policy"
    };

    for (const [label, key] of Object.entries(checks)) {
        report.securityHeaders[label] = report.headers[key] || null;
    }

}

//===========================================================
// BROKEN LINK CHECKER
//===========================================================

async function checkBrokenLinks(report) {

    const candidates = [...new Set(report.internalLinks)]
        .map(href => {
            try {
                return new URL(href, TARGET).href;
            } catch {
                return null;
            }
        })
        .filter(Boolean)
        .slice(0, 25);

    const concurrency = 5;
    let index = 0;

    async function worker() {

        while (index < candidates.length) {

            const url = candidates[index++];

            try {

                let res = await axios.head(url, {
                    timeout: 8000,
                    validateStatus: () => true,
                    headers: { "User-Agent": "SenderAuditor/1.0" }
                });

                // Some servers reject HEAD outright — fall back to GET
                // before concluding the link is broken.
                if (res.status === 405) {
                    res = await axios.get(url, {
                        timeout: 8000,
                        validateStatus: () => true,
                        headers: { "User-Agent": "SenderAuditor/1.0" }
                    });
                }

                if (res.status >= 400) {
                    report.brokenLinks.push({ url, status: res.status });
                }

            } catch {

                report.brokenLinks.push({ url, status: "ERROR" });

            }

        }

    }

    await Promise.all(
        Array.from({ length: concurrency }, worker)
    );

}

//===========================================================
// GEO-IP LOOKUP (external service: ip-api.com)
//===========================================================

async function checkGeoIP(report) {

    if (!report.ip) {
        report.geo = null;
        return;
    }

    try {

        const res = await axios.get(
            `http://ip-api.com/json/${report.ip}`,
            { timeout: 8000 }
        );

        if (res.data && res.data.status === "success") {

            report.geo = {
                country: res.data.country,
                region: res.data.regionName,
                city: res.data.city,
                isp: res.data.isp,
                org: res.data.org
            };

        } else {

            report.geo = null;

        }

    } catch {

        report.geo = null;

    }

}

//===========================================================
// OS GUESS (best-effort, not reliable over HTTP alone)
//===========================================================

function guessOS(report) {

    const server = (report.server || "").toLowerCase();
    const poweredBy = (report.headers["x-powered-by"] || "").toLowerCase();
    const combined = `${server} ${poweredBy}`;

    if (combined.includes("win") || combined.includes("iis")) {
        report.osGuess = "Likely Windows";
    } else if (
        combined.includes("ubuntu") ||
        combined.includes("debian") ||
        combined.includes("centos") ||
        combined.includes("unix") ||
        combined.includes("linux")
    ) {
        report.osGuess = "Likely Linux/Unix";
    } else if (
        combined.includes("nginx") ||
        combined.includes("apache") ||
        combined.includes("cloudflare")
    ) {
        report.osGuess = "Likely Linux/Unix (inferred from server software)";
    } else {
        report.osGuess = "Unknown — not reliably detectable over HTTP";
    }

}

//===========================================================
// TECH STACK DETECTION (signal-based, not certain)
//===========================================================

function detectTechStack(report, html) {

    const signals = new Set();

    const server = (report.server || "").toLowerCase();
    const poweredBy = (report.headers["x-powered-by"] || "").toLowerCase();

    if (server.includes("cloudflare")) signals.add("Cloudflare (CDN/proxy)");
    if (server.includes("nginx")) signals.add("Nginx");
    if (server.includes("apache")) signals.add("Apache");
    if (poweredBy.includes("php")) signals.add("PHP");
    if (poweredBy.includes("express")) signals.add("Express (Node.js)");
    if (poweredBy.includes("asp.net")) signals.add("ASP.NET");

    const $ = cheerio.load(html);
    const generator = $('meta[name="generator"]').attr("content");

    if (generator) signals.add(generator);

    if (html.includes("wp-content") || html.includes("wp-includes")) signals.add("WordPress");
    if (html.includes("_next/static")) signals.add("Next.js");
    if (html.includes("create-react-app") || report.description.includes("create-react-app")) signals.add("React (Create React App)");
    if (html.includes("__NUXT__")) signals.add("Nuxt.js");
    if (html.includes("cdn.shopify.com")) signals.add("Shopify");
    if (html.includes("wix.com") || html.includes("wixstatic.com")) signals.add("Wix");
    if (html.toLowerCase().includes("squarespace")) signals.add("Squarespace");
    if (html.includes("Drupal.settings")) signals.add("Drupal");

    report.techStack = [...signals];

}

//===========================================================
// JSON EXPORT
//===========================================================

function exportJSON(report) {

    const filename = "report.json";

    fs.writeFileSync(filename, JSON.stringify(report, null, 2));

    success(`Report written to ${filename}`);

}

//===========================================================
// PRINT REPORT
//===========================================================

function printReport(report) {

    if (!WATCH_ENABLED)
        console.clear();

    line();
    console.log(chalk.green.bold("          SENDER AUDITOR v1.0"));
    line();

    console.log(chalk.white("Target           :"), report.target);
    console.log(chalk.white("Status           :"), report.status);
    console.log(chalk.white("HTTPS            :"), report.https ? "Yes" : "No");
    console.log(chalk.white("Response Time    :"), report.responseTime);
    console.log(chalk.white("Server           :"), report.server);
    console.log(chalk.white("Content Type     :"), report.contentType);
    console.log(chalk.white("HTML Size        :"), report.htmlSize + " bytes");
    console.log(chalk.white("IP Address       :"), report.ip || "Unknown");
    console.log(chalk.white("OS Guess         :"), report.osGuess);

    section("PAGE INFORMATION");

    console.log("Title            :", report.title || "None");
    console.log("Language         :", report.language);
    console.log("Description      :", report.description || "None");

    section("TECH STACK (detected signals, not certain)");

    if (report.techStack.length === 0) {
        warning("No recognizable tech signals found.");
    } else {
        report.techStack.forEach(t => console.log("•", t));
    }

    section("DNS RECORDS");

    for (const type of ["A", "AAAA", "MX", "NS", "CNAME", "TXT"]) {

        const records = report.dns[type] || [];

        const formatted = type === "MX"
            ? records.map(r => `${r.exchange} (priority ${r.priority})`)
            : records;

        console.log(
            `${type.padEnd(6)}:`,
            formatted.length ? formatted.join(", ") : "—"
        );

    }

    section("GEO-IP (via ip-api.com)");

    if (report.geo) {
        console.log("Location         :", `${report.geo.city || "?"}, ${report.geo.region || "?"}, ${report.geo.country || "?"}`);
        console.log("ISP              :", report.geo.isp || "Unknown");
        console.log("Org              :", report.geo.org || "Unknown");
    } else {
        warning("Geo-IP lookup unavailable.");
    }

    section("SSL CERTIFICATE");

    if (report.ssl) {
        console.log("Issuer           :", report.ssl.issuer);
        console.log("Valid From       :", report.ssl.validFrom);
        console.log("Valid To         :", report.ssl.validTo);

        if (report.ssl.daysRemaining <= 14) {
            warning(`Expires in ${report.ssl.daysRemaining} days`);
        } else {
            console.log("Days Remaining   :", report.ssl.daysRemaining);
        }
    } else {
        warning("No SSL certificate info (not HTTPS, or lookup failed).");
    }

    section("SECURITY HEADERS");

    for (const [label, value] of Object.entries(report.securityHeaders)) {
        if (value) {
            success(`${label}: ${value}`);
        } else {
            warning(`${label}: Missing`);
        }
    }

    section("HEADINGS");

    if (report.headings.length === 0) {
        warning("No H1 headings found.");
    } else {
        report.headings.forEach((heading, index) => {
            console.log(`H1 ${index + 1}: ${heading}`);
        });
    }

    section("STATISTICS");

    console.log("Links            :", report.links.length);
    console.log("Internal Links   :", report.internalLinks.length);
    console.log("External Links   :", report.externalLinks.length);
    console.log("Images           :", report.images.length);
    console.log("Scripts          :", report.scripts.length);
    console.log("Stylesheets      :", report.stylesheets.length);

    section("EMAILS");

    if (report.emails.length === 0) {
        warning("No email addresses found.");
    } else {
        report.emails.forEach(email => console.log("•", email));
    }

    section("PHONE NUMBERS");

    if (report.phones.length === 0) {
        warning("No phone numbers found.");
    } else {
        report.phones.forEach(phone => console.log("•", phone));
    }

    section("FILES");

    console.log(
        "robots.txt       :",
        report.robots
            ? chalk.green("FOUND")
            : chalk.red("NOT FOUND")
    );

    console.log(
        "sitemap.xml      :",
        report.sitemap
            ? chalk.green("FOUND")
            : chalk.red("NOT FOUND")
    );

    section("BROKEN LINKS (first 25 internal links checked)");

    if (report.brokenLinks.length === 0) {
        success("No broken links detected.");
    } else {
        report.brokenLinks.forEach(b => error(`${b.status}  ${b.url}`));
    }

    section("LINK PREVIEW");

    if (report.links.length === 0) {

        warning("No links found.");

    } else {

        report.links.slice(0, 20).forEach((link, i) => {
            console.log(`${i + 1}. ${link}`);
        });

        if (report.links.length > 20) {
            console.log(
                chalk.yellow(
                    `...and ${report.links.length - 20} more`
                )
            );
        }

    }

    line();
    success("Audit Completed Successfully");
    line();
}

//===========================================================
// DIFF (used in watch mode to flag changes between runs)
//===========================================================

function diffReports(prev, curr) {

    if (prev.status !== curr.status) {
        warning(`Status changed: ${prev.status} -> ${curr.status}`);
    }

    if (prev.contentHash !== curr.contentHash) {
        warning("Page content changed since last check.");
    }

    if (
        prev.ssl && curr.ssl &&
        curr.ssl.daysRemaining <= 14 &&
        prev.ssl.daysRemaining !== curr.ssl.daysRemaining
    ) {
        warning(`SSL certificate expiring soon: ${curr.ssl.daysRemaining} days remaining.`);
    }

    if (curr.robots !== prev.robots || curr.sitemap !== prev.sitemap) {
        warning("robots.txt / sitemap.xml availability changed.");
    }

}

//===========================================================
// RUN A SINGLE AUDIT PASS
//===========================================================

async function runAudit() {

    const report = freshReport();

    const html = await fetchPage(report, TARGET);

    parseHTML(report, html);
    extractEmails(report, html);
    extractPhones(report, html);
    detectTechStack(report, html);

    await Promise.all([
        checkRobots(report),
        checkSitemap(report),
        checkSSL(report),
        checkDNS(report)
    ]);

    guessOS(report);
    auditSecurityHeaders(report);

    await Promise.all([
        checkGeoIP(report),
        checkBrokenLinks(report)
    ]);

    return report;

}

//===========================================================
// MAIN
//===========================================================

async function runOnce() {

    try {

        line();
        console.log(chalk.green.bold("Starting Sender Auditor"));
        line();

        const report = await runAudit();

        if (JSON_OUTPUT) {
            exportJSON(report);
        } else {
            printReport(report);
        }

    } catch (err) {

        error("Audit Failed");
        console.log();
        console.log(chalk.red(err.message));

    }

}

async function runWatch() {

    console.log(
        chalk.cyan.bold(
            `Watch mode enabled — checking every ${WATCH_INTERVAL_MS / 1000}s. Press Ctrl+C to stop.`
        )
    );

    let previous = null;

    while (true) {

        try {

            const report = await runAudit();

            if (JSON_OUTPUT) {
                exportJSON(report);
            } else {
                printReport(report);
            }

            if (previous) {
                section("CHANGES SINCE LAST CHECK");
                diffReports(previous, report);
            }

            previous = report;

        } catch (err) {

            error("Audit Failed");
            console.log(chalk.red(err.message));

        }

        await sleep(WATCH_INTERVAL_MS);

    }

}

async function main() {

    if (WATCH_ENABLED) {
        await runWatch();
    } else {
        await runOnce();
    }

}


main();
