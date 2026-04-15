import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { AFFILIATES } from "@/lib/affiliates";

const BASE_URL = "https://os-vault-kappa.vercel.app";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await supabase
    .from("vulnerabilities")
    .select("cvss_severity, description")
    .eq("cve_id", id)
    .single();
  const severity = data?.cvss_severity ?? "CVE";
  const desc = data?.description?.slice(0, 155) ?? `Security vulnerability details, CVSS score, and risk analysis for ${id}.`;
  return {
    title: `${id} — ${severity} Severity Vulnerability`,
    description: desc,
    alternates: { canonical: `${BASE_URL}/cve/${id}` },
    openGraph: { title: `${id} ${severity} Vulnerability`, description: desc, url: `${BASE_URL}/cve/${id}`, siteName: "OsVault", type: "article" },
  };
}

/* ── Design tokens ── */
const SEV: Record<string, { color: string; bg: string; border: string }> = {
  CRITICAL: { color: "#ef4444", bg: "rgba(239, 68, 68, 0.1)", border: "rgba(239, 68, 68, 0.2)" },
  HIGH:     { color: "#f97316", bg: "rgba(249, 115, 22, 0.1)", border: "rgba(249, 115, 22, 0.2)" },
  MEDIUM:   { color: "#eab308", bg: "rgba(234, 179, 8, 0.1)", border: "rgba(234, 179, 8, 0.2)" },
  LOW:      { color: "#22c55e", bg: "rgba(34, 197, 94, 0.1)", border: "rgba(34, 197, 94, 0.2)" },
};

const SEVERITY_COLORS: Record<string, string> = {
  low: "#22c55e", medium: "#eab308", high: "#f97316", critical: "#ef4444",
};

/* ── Shared typography ── */
const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const SANS = "'Inter', -apple-system, sans-serif";
const sectionLabel = {
  fontSize: 11, fontWeight: 600 as const, color: "var(--slate-dim)",
  textTransform: "uppercase" as const, letterSpacing: "0.1em",
  fontFamily: MONO, marginBottom: 20,
};
const h2Style = {
  fontSize: 22, fontWeight: 700 as const, letterSpacing: "-0.02em",
  color: "var(--white-pure)", marginBottom: 8, lineHeight: 1.3,
  fontFamily: SANS,
};
const hairline = { width: "100%", height: 1, background: "var(--border)" };

// ---------------------------------------------------------------------------
// TL;DR Parser
// ---------------------------------------------------------------------------
function parseTldr(description: string | null): { target?: string; versions?: string; vulnType?: string } {
  if (!description) return {};
  const result: { target?: string; versions?: string; vulnType?: string } = {};

  const vulnTypes: [RegExp, string][] = [
    [/remote code execution/i, "Remote Code Execution (RCE)"],
    [/arbitrary code execution/i, "Arbitrary Code Execution"],
    [/arbitrary file (?:upload|deletion|read|write|overwrite)/i, "$0"],
    [/sql injection/i, "SQL Injection"],
    [/cross[\s-]?site[\s-]?scripting|reflected xss|stored xss|\bxss\b/i, "Cross-Site Scripting (XSS)"],
    [/cross[\s-]?site[\s-]?request[\s-]?forgery|\bcsrf\b|\bxsrf\b/i, "Cross-Site Request Forgery (CSRF)"],
    [/server[\s-]?side[\s-]?request[\s-]?forgery|\bssrf\b/i, "Server-Side Request Forgery (SSRF)"],
    [/path traversal|directory traversal/i, "Path Traversal"],
    [/privilege[\s-]?escalation/i, "Privilege Escalation"],
    [/denial[\s-]?of[\s-]?service|\bdos\b|\bddos\b/i, "Denial of Service (DoS)"],
    [/buffer overflow|heap overflow|stack overflow/i, "Buffer Overflow"],
    [/information (?:disclosure|exposure|leak)/i, "Information Disclosure"],
    [/authentication bypass|auth bypass/i, "Authentication Bypass"],
    [/insecure deserialization/i, "Insecure Deserialization"],
    [/command injection|os command injection/i, "Command Injection"],
    [/xml external entity|\bxxe\b/i, "XML External Entity (XXE)"],
    [/open redirect/i, "Open Redirect"],
    [/unrestricted upload/i, "Unrestricted File Upload"],
    [/improper (?:access control|authorization)/i, "Improper Access Control"],
    [/use[\s-]?after[\s-]?free/i, "Use-After-Free"],
    [/integer overflow/i, "Integer Overflow"],
    [/null pointer dereference/i, "Null Pointer Dereference"],
    [/out[\s-]?of[\s-]?bounds (?:read|write)/i, "Out-of-Bounds Memory Access"],
    [/missing authorization/i, "Missing Authorization"],
    [/broken access control/i, "Broken Access Control"],
  ];

  for (const [re, label] of vulnTypes) {
    const match = description.match(re);
    if (match) {
      result.vulnType = label === "$0" ? match[0].replace(/\b\w/g, c => c.toUpperCase()) : label;
      break;
    }
  }

  const versionPatterns = [
    /(?:(?:before|prior to|through|up to(?: and including)?)\s+)(v?[\d]+(?:\.[\d]+){1,4}(?:[.\-][\w]+)?)/i,
    /(?:versions?\s+)?(?:<=?|lt)\s*(v?[\d]+(?:\.[\d]+){1,4}(?:[.\-][\w]+)?)/i,
    /(?:(?:affects?|impacting?|vulnerable)\s.*?versions?\s+)([\d]+(?:\.[\d]+){1,4}\s*(?:through|to|-)\s*[\d]+(?:\.[\d]+){1,4})/i,
    /(?:versions?\s+)([\d]+(?:\.[\d]+){1,4}\s*(?:through|to|-)\s*[\d]+(?:\.[\d]+){1,4})/i,
  ];

  for (const re of versionPatterns) {
    const m = description.match(re);
    if (m) {
      const fullMatch = m[0].toLowerCase();
      result.versions = /before|prior to|through|up to|<=|lt/i.test(fullMatch) ? `≤ ${m[1]}` : m[1];
      break;
    }
  }

  const targetPatterns = [
    /(?:in|the)\s+([\w][\w\s\-.']{1,50}?)\s+(?:plugin|theme|extension|module|package|library|component|widget|add[\s-]?on)\s+(?:for\s+)?([\w\s]+?)(?:\s+(?:before|prior|through|allows|is))/i,
    /(?:in|the)\s+([\w][\w\s\-.']{1,50}?)\s+(?:plugin|theme|extension|module|package|library|component|widget|add[\s-]?on)/i,
    /([\w][\w\s\-.']{1,40}?)\s+(?:plugin|theme|extension|module|package|library)\s+(?:for\s+)?([\w\s]+?)(?:\s+(?:before|prior|through|version|<=))/i,
  ];

  for (const re of targetPatterns) {
    const m = description.match(re);
    if (m) {
      let target = m[1].trim();
      if (m[2]) {
        const platform = m[2].trim();
        if (platform.length < 30 && !/before|prior|through|allows|is/i.test(platform)) target = `${target} (${platform})`;
      }
      target = target.replace(/\s+(?:the|a|an)$/i, "").trim();
      if (target.length > 2) result.target = target;
      break;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// CVSS Vector Parser
// ---------------------------------------------------------------------------
interface CvssMetric {
  key: string; label: string; value: string;
  severity: "low" | "medium" | "high" | "critical";
  /** 0–1 numeric weight for the bar chart */
  weight: number;
}

const CVSS_LABELS: Record<string, string> = {
  AV: "Attack Vector", AC: "Attack Complexity", PR: "Privileges Required",
  UI: "User Interaction", S: "Scope", C: "Confidentiality Impact",
  I: "Integrity Impact", A: "Availability Impact",
};

const CVSS_DECODE: Record<string, Record<string, { text: string; severity: "low" | "medium" | "high" | "critical"; weight: number }>> = {
  AV: { N: { text: "Network", severity: "critical", weight: 1.0 }, A: { text: "Adjacent", severity: "high", weight: 0.7 }, L: { text: "Local", severity: "medium", weight: 0.4 }, P: { text: "Physical", severity: "low", weight: 0.15 } },
  AC: { L: { text: "Low", severity: "high", weight: 0.85 }, H: { text: "High", severity: "low", weight: 0.3 } },
  PR: { N: { text: "None", severity: "critical", weight: 1.0 }, L: { text: "Low", severity: "medium", weight: 0.55 }, H: { text: "High", severity: "low", weight: 0.2 } },
  UI: { N: { text: "None", severity: "high", weight: 0.85 }, R: { text: "Required", severity: "low", weight: 0.3 } },
  S:  { U: { text: "Unchanged", severity: "low", weight: 0.3 }, C: { text: "Changed", severity: "high", weight: 0.85 } },
  C:  { N: { text: "None", severity: "low", weight: 0.05 }, L: { text: "Low", severity: "medium", weight: 0.5 }, H: { text: "High", severity: "critical", weight: 1.0 } },
  I:  { N: { text: "None", severity: "low", weight: 0.05 }, L: { text: "Low", severity: "medium", weight: 0.5 }, H: { text: "High", severity: "critical", weight: 1.0 } },
  A:  { N: { text: "None", severity: "low", weight: 0.05 }, L: { text: "Low", severity: "medium", weight: 0.5 }, H: { text: "High", severity: "critical", weight: 1.0 } },
};

function parseCvssVector(vector: string): CvssMetric[] {
  const raw = vector.replace(/^CVSS:\d+\.\d+\//i, "");
  const metrics: CvssMetric[] = [];
  for (const pair of raw.split("/")) {
    const [key, val] = pair.split(":");
    if (!key || !val) continue;
    const label = CVSS_LABELS[key];
    const decoded = CVSS_DECODE[key]?.[val];
    if (label && decoded) metrics.push({ key, label, value: decoded.text, severity: decoded.severity, weight: decoded.weight });
  }
  return metrics;
}

/** SVG horizontal bar chart — looks like a research assessment diagram */
function CvssBarChart({ metrics }: { metrics: CvssMetric[] }) {
  if (metrics.length === 0) return null;

  const barH = 22;
  const gap = 10;
  const labelW = 150;
  const valueW = 90;
  const barW = 240;
  const totalW = labelW + barW + valueW + 24;
  const totalH = metrics.length * (barH + gap) - gap + 16;

  return (
    <svg
      viewBox={`0 0 ${totalW} ${totalH}`}
      width="100%"
      style={{ maxWidth: 560, display: "block" }}
      role="img"
      aria-label="CVSS v3.1 attack vector breakdown chart"
    >
      {metrics.map((m, i) => {
        const y = i * (barH + gap) + 8;
        const fill = SEVERITY_COLORS[m.severity];
        const barFill = m.weight * barW;
        return (
          <g key={m.key}>
            {/* Label */}
            <text
              x={labelW - 12}
              y={y + barH / 2 + 1}
              textAnchor="end"
              dominantBaseline="middle"
              fill="var(--text-2)"
              fontSize="11"
              fontFamily={MONO}
              fontWeight="500"
            >
              {m.label}
            </text>
            {/* Track */}
            <rect x={labelW} y={y + 2} width={barW} height={barH - 4} rx={3} fill="rgba(255,255,255,0.04)" />
            {/* Fill */}
            <rect x={labelW} y={y + 2} width={barFill} height={barH - 4} rx={3} fill={fill} opacity={0.85} />
            {/* Value label */}
            <text
              x={labelW + barW + 12}
              y={y + barH / 2 + 1}
              dominantBaseline="middle"
              fill={fill}
              fontSize="11"
              fontFamily={SANS}
              fontWeight="600"
            >
              {m.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Donut score graphic for the risk gauge */
function ScoreDonut({ score, maxScore, color, label }: { score: number; maxScore: number; color: string; label: string }) {
  const r = 38;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(score / maxScore, 1);
  const offset = circumference * (1 - pct);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width={92} height={92} viewBox="0 0 92 92" role="img" aria-label={`${label}: ${score}`}>
        {/* Track */}
        <circle cx={46} cy={46} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={6} />
        {/* Fill arc */}
        <circle
          cx={46} cy={46} r={r} fill="none"
          stroke={color} strokeWidth={6}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 46 46)"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        {/* Center score */}
        <text x={46} y={48} textAnchor="middle" dominantBaseline="middle"
          fill={color} fontSize="22" fontWeight="800" fontFamily={SANS} letterSpacing="-0.03em">
          {typeof score === "number" ? (score % 1 === 0 ? score : score.toFixed(1)) : "—"}
        </text>
      </svg>
      <span style={{ fontSize: 10, fontWeight: 600, color: "var(--slate-dim)", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: MONO }}>
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Related Vulnerabilities — server-side lateral link queries
// ---------------------------------------------------------------------------
async function fetchRelatedCves(
  currentCveId: string, severity: string | null,
  publishedAt: string | null, ecosystems: string[],
) {
  type RelatedSection = { label: string; cves: { cve_id: string; cvss_severity: string | null }[] };
  const queries: Promise<RelatedSection>[] = [];

  if (severity) {
    queries.push(
      Promise.resolve(
        supabase.from("vulnerabilities").select("cve_id, cvss_severity")
          .eq("source", "nvd").eq("cvss_severity", severity)
          .neq("cve_id", currentCveId).not("cve_id", "is", null).limit(5)
      ).then(({ data }) => ({ label: `Other ${severity} Severity Vulnerabilities`, cves: (data ?? []) as RelatedSection["cves"] }))
    );
  }

  if (publishedAt) {
    const d = new Date(publishedAt);
    const s = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
    const e = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const ml = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    queries.push(
      Promise.resolve(
        supabase.from("vulnerabilities").select("cve_id, cvss_severity")
          .eq("source", "nvd").gte("published_at", s).lte("published_at", e)
          .neq("cve_id", currentCveId).not("cve_id", "is", null)
          .order("published_at", { ascending: false }).limit(5)
      ).then(({ data }) => ({ label: `Recent Vulnerabilities from ${ml}`, cves: (data ?? []) as RelatedSection["cves"] }))
    );
  }

  if (ecosystems.length > 0) {
    const eco = ecosystems[0];
    queries.push(
      Promise.resolve(
        supabase.from("vulnerabilities").select("cve_id, cvss_severity")
          .eq("source", "nvd").neq("cve_id", currentCveId)
          .not("cve_id", "is", null).not("cvss_severity", "is", null).limit(5)
      ).then(({ data }) => ({ label: `Other ${eco} Ecosystem Vulnerabilities`, cves: (data ?? []) as RelatedSection["cves"] }))
    );
  }

  return (await Promise.all(queries)).filter(r => r.cves.length > 0);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function CVEPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data, error } = await supabase.from("vulnerabilities").select("*").eq("cve_id", id).single();
  if (error || !data) return notFound();

  const sev = SEV[data.cvss_severity ?? ""] ?? { color: "var(--text-2)", bg: "rgba(255,255,255,0.05)", border: "var(--border)" };
  const publishedDate = data.published_at ? new Date(data.published_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : null;
  const modifiedDate  = data.modified_at  ? new Date(data.modified_at).toLocaleDateString("en-US",  { year: "numeric", month: "long", day: "numeric" }) : null;

  const affectedPackages: { name: string; ecosystem: string; versions?: string[] }[] =
    Array.isArray(data.affected_packages) ? data.affected_packages :
    typeof data.affected_packages === "string" ? JSON.parse(data.affected_packages) : [];

  const isCriticalOrHigh = data.cvss_severity === "CRITICAL" || data.cvss_severity === "HIGH";
  const riskColor = (data.combined_risk_score ?? 0) >= 70 ? "#ef4444" : (data.combined_risk_score ?? 0) >= 40 ? "#f97316" : "#22c55e";
  const tldr = parseTldr(data.description);
  const hasTldr = !!(tldr.target || tldr.versions || tldr.vulnType);
  const cvssMetrics = data.cvss_vector ? parseCvssVector(data.cvss_vector) : [];
  const ecosystems = [...new Set(affectedPackages.map(p => p.ecosystem).filter(Boolean))];
  const relatedSections = await fetchRelatedCves(data.cve_id, data.cvss_severity, data.published_at, ecosystems);

  const jsonLd = {
    "@context": "https://schema.org", "@type": "Article",
    "headline": `${data.cve_id} — ${data.cvss_severity ?? "CVE"} Severity Vulnerability`,
    "description": data.description?.slice(0, 200),
    "datePublished": data.published_at, "dateModified": data.modified_at,
    "url": `${BASE_URL}/cve/${data.cve_id}`,
    "publisher": { "@type": "Organization", "name": "OsVault", "url": BASE_URL },
  };

  return (
    <article style={{ maxWidth: 740, margin: "0 auto", padding: "80px 28px 120px", fontFamily: SANS }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ═══════════════════════════════════════════════════════════════════
          §1 — HEADER
          ═══════════════════════════════════════════════════════════════════ */}
      <header style={{ marginBottom: 56 }}>
        {/* Breadcrumb */}
        <nav style={{ fontSize: 12, fontFamily: MONO, color: "var(--slate-dim)", marginBottom: 40, display: "flex", gap: 8, letterSpacing: "0.04em" }}>
          <a href="/" style={{ color: "var(--slate)", textDecoration: "none" }}>osvault</a>
          <span style={{ opacity: 0.4 }}>/</span>
          <span>advisories</span>
          <span style={{ opacity: 0.4 }}>/</span>
          <span style={{ color: "var(--text)" }}>{data.cve_id?.toLowerCase()}</span>
        </nav>

        {/* Severity + KEV inline */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: sev.color, fontFamily: MONO,
            letterSpacing: "0.08em", textTransform: "uppercase",
          }}>
            {data.cvss_severity ?? "UNKNOWN"} SEVERITY
          </span>
          {data.in_kev && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "#fca5a5", fontFamily: MONO, letterSpacing: "0.06em" }}>
              ⚠ CISA KEV
            </span>
          )}
          {publishedDate && (
            <span style={{ fontSize: 12, color: "var(--slate-dim)", marginLeft: "auto", fontFamily: MONO }}>
              {publishedDate}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 style={{ fontSize: "clamp(28px, 4.5vw, 42px)", fontWeight: 800, letterSpacing: "-0.035em", color: "var(--white-pure)", marginBottom: 0, lineHeight: 1.15 }}>
          {data.cve_id}
        </h1>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════
          §2 — ABSTRACT (TL;DR + Description)
          ═══════════════════════════════════════════════════════════════════ */}
      <section style={{ marginBottom: 56 }}>
        <div style={sectionLabel}>Abstract</div>

        {hasTldr && (
          <dl id="tldr-summary" style={{
            margin: "0 0 28px 0", padding: "0 0 0 20px",
            borderLeft: `2px solid ${sev.color}`,
            display: "flex", flexDirection: "column", gap: 6,
          }}>
            {tldr.target && (
              <div style={{ display: "flex", gap: 12 }}>
                <dt style={{ fontSize: 12, fontWeight: 600, color: "var(--slate-dim)", fontFamily: MONO, minWidth: 90, letterSpacing: "0.04em" }}>Target</dt>
                <dd style={{ margin: 0, fontSize: 15, fontWeight: 500, color: "var(--text)", lineHeight: 1.5 }}>{tldr.target}</dd>
              </div>
            )}
            {tldr.versions && (
              <div style={{ display: "flex", gap: 12 }}>
                <dt style={{ fontSize: 12, fontWeight: 600, color: "var(--slate-dim)", fontFamily: MONO, minWidth: 90, letterSpacing: "0.04em" }}>Versions</dt>
                <dd style={{ margin: 0, fontSize: 15, fontWeight: 600, color: sev.color, fontFamily: MONO }}>{tldr.versions}</dd>
              </div>
            )}
            {tldr.vulnType && (
              <div style={{ display: "flex", gap: 12 }}>
                <dt style={{ fontSize: 12, fontWeight: 600, color: "var(--slate-dim)", fontFamily: MONO, minWidth: 90, letterSpacing: "0.04em" }}>Class</dt>
                <dd style={{ margin: 0, fontSize: 15, fontWeight: 500, color: "var(--text)", lineHeight: 1.5 }}>{tldr.vulnType}</dd>
              </div>
            )}
          </dl>
        )}

        <p style={{ fontSize: 16, color: "var(--text-2)", lineHeight: 1.75, fontWeight: 400, maxWidth: 680 }}>
          {data.description ?? "No detailed description available for this vulnerability."}
        </p>
      </section>

      <div style={hairline} />

      {/* ═══════════════════════════════════════════════════════════════════
          §3 — RISK ASSESSMENT (Score donuts + EPSS)
          ═══════════════════════════════════════════════════════════════════ */}
      <section style={{ marginTop: 48, marginBottom: 56 }}>
        <div style={sectionLabel}>Risk Assessment</div>

        <div style={{ display: "flex", gap: 40, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Score donuts */}
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            {data.cvss_score != null && (
              <ScoreDonut score={data.cvss_score} maxScore={10} color={sev.color} label="CVSS Base" />
            )}
            {data.combined_risk_score != null && (
              <ScoreDonut score={data.combined_risk_score} maxScore={100} color={riskColor} label="Risk Score" />
            )}
          </div>

          {/* Side metrics — tabular, not boxed */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
              <tbody>
                {data.epss_score != null && (
                  <tr>
                    <td style={{ padding: "8px 16px 8px 0", color: "var(--slate-dim)", fontFamily: MONO, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", verticalAlign: "top", whiteSpace: "nowrap" }}>EPSS Probability</td>
                    <td style={{ padding: "8px 0", color: data.epss_score > 0.5 ? "#ef4444" : "var(--text)", fontWeight: 700, fontSize: 18 }}>
                      {(data.epss_score * 100).toFixed(1)}%
                      <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-2)", marginLeft: 8 }}>real-world exploitability</span>
                    </td>
                  </tr>
                )}
                {data.exploit_maturity && (
                  <tr>
                    <td style={{ padding: "8px 16px 8px 0", color: "var(--slate-dim)", fontFamily: MONO, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", verticalAlign: "top", whiteSpace: "nowrap" }}>Exploit Maturity</td>
                    <td style={{ padding: "8px 0", color: "var(--text)", fontWeight: 500 }}>{data.exploit_maturity}</td>
                  </tr>
                )}
                {data.risk_confidence && (
                  <tr>
                    <td style={{ padding: "8px 16px 8px 0", color: "var(--slate-dim)", fontFamily: MONO, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", verticalAlign: "top", whiteSpace: "nowrap" }}>Confidence</td>
                    <td style={{ padding: "8px 0", color: "var(--text)", fontWeight: 500 }}>{data.risk_confidence}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ padding: "8px 16px 8px 0", color: "var(--slate-dim)", fontFamily: MONO, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", verticalAlign: "top", whiteSpace: "nowrap" }}>Known Exploited</td>
                  <td style={{ padding: "8px 0", color: data.in_kev ? "#ef4444" : "var(--text)", fontWeight: 500 }}>
                    {data.in_kev ? "Yes — listed in CISA KEV catalog" : "No"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div style={hairline} />

      {/* ═══════════════════════════════════════════════════════════════════
          §4 — ATTACK VECTOR PROFILE (SVG bar chart)
          ═══════════════════════════════════════════════════════════════════ */}
      {data.cvss_vector && (
        <section style={{ marginTop: 48, marginBottom: 56 }}>
          <div style={sectionLabel}>Attack Vector Profile</div>
          <h2 style={{ ...h2Style, marginBottom: 4 }}>CVSS v3.1 Metric Breakdown</h2>
          <p style={{ fontSize: 13, color: "var(--slate-dim)", marginBottom: 28, lineHeight: 1.5 }}>
            Each bar represents the severity contribution of a single CVSS metric. Longer bars indicate higher risk factors.
          </p>

          {/* SVG bar chart */}
          <CvssBarChart metrics={cvssMetrics} />

          {/* Raw vector reference */}
          <div style={{ marginTop: 24 }}>
            <code style={{ fontSize: 12, color: "var(--green)", fontFamily: MONO, fontWeight: 500, opacity: 0.7 }}>
              {data.cvss_vector}
            </code>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          §5 — AFFECTED SOFTWARE
          ═══════════════════════════════════════════════════════════════════ */}
      {affectedPackages.length > 0 && (
        <>
          <div style={hairline} />
          <section style={{ marginTop: 48, marginBottom: 56 }}>
            <div style={sectionLabel}>Affected Software</div>
            <h2 style={h2Style}>Vulnerable Packages</h2>

            <div style={{ overflowX: "auto", marginTop: 20 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr>
                    <th style={{ padding: "0 16px 14px 0", textAlign: "left", color: "var(--slate-dim)", fontWeight: 600, fontSize: 11, fontFamily: MONO, letterSpacing: "0.06em", borderBottom: "1px solid var(--border)" }}>Ecosystem</th>
                    <th style={{ padding: "0 16px 14px 0", textAlign: "left", color: "var(--slate-dim)", fontWeight: 600, fontSize: 11, fontFamily: MONO, letterSpacing: "0.06em", borderBottom: "1px solid var(--border)" }}>Package</th>
                    <th style={{ padding: "0 0 14px 0", textAlign: "left", color: "var(--slate-dim)", fontWeight: 600, fontSize: 11, fontFamily: MONO, letterSpacing: "0.06em", borderBottom: "1px solid var(--border)" }}>Affected Versions</th>
                  </tr>
                </thead>
                <tbody>
                  {affectedPackages.map((pkg, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border-2)" }}>
                      <td style={{ padding: "14px 16px 14px 0", verticalAlign: "top" }}>
                        <span style={{ fontSize: 12, color: "var(--slate-dim)", fontFamily: MONO, textTransform: "uppercase" }}>{pkg.ecosystem}</span>
                      </td>
                      <td style={{ padding: "14px 16px 14px 0", verticalAlign: "top" }}>
                        <strong style={{ fontWeight: 500, color: "var(--text)" }}>
                          {pkg.ecosystem?.toLowerCase() === "npm"
                            ? <a href={`/npm/${encodeURIComponent(pkg.name)}`} style={{ textDecoration: "underline", textUnderlineOffset: 4, textDecorationColor: "var(--border)" }}>{pkg.name}</a>
                            : pkg.name}
                        </strong>
                      </td>
                      <td style={{ padding: "14px 0", verticalAlign: "top", color: "var(--text-2)", fontFamily: MONO, fontSize: 12, lineHeight: 1.7 }}>
                        {pkg.versions?.slice(0, 8).join(", ") ?? "All or unspecified versions"}
                        {(pkg.versions?.length ?? 0) > 8 && <span style={{ color: "var(--slate-dim)" }}> +{pkg.versions!.length - 8} more</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          §6 — CONFIGURATIONS (CPE)
          ═══════════════════════════════════════════════════════════════════ */}
      {data.cpe_list?.length > 0 && (
        <>
          <div style={hairline} />
          <section style={{ marginTop: 48, marginBottom: 56 }}>
            <div style={sectionLabel}>Configurations</div>
            <h2 style={h2Style}>Affected Platforms (CPE)</h2>
            <div style={{ marginTop: 16, paddingLeft: 20, borderLeft: "2px solid var(--border)", fontFamily: MONO, overflowX: "auto" }}>
              <pre style={{ margin: 0, fontSize: 11, color: "var(--text-3)", lineHeight: 1.8 }}>
                {data.cpe_list.slice(0, 15).join('\n')}
                {data.cpe_list.length > 15 && `\n\n… ${data.cpe_list.length - 15} additional configurations omitted.`}
              </pre>
            </div>
          </section>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          §7 — RELATED ADVISORIES (lateral internal links)
          ═══════════════════════════════════════════════════════════════════ */}
      {relatedSections.length > 0 && (
        <>
          <div style={hairline} />
          <section id="related-vulnerabilities" style={{ marginTop: 48, marginBottom: 56 }}>
            <div style={sectionLabel}>Related Advisories</div>

            {relatedSections.map((section, i) => (
              <div key={i} style={{ marginBottom: i < relatedSections.length - 1 ? 32 : 0 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 12, letterSpacing: "-0.01em" }}>
                  {section.label}
                </h3>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 0 }}>
                  {section.cves.map((cve, j) => {
                    const ls = SEV[cve.cvss_severity ?? ""];
                    return (
                      <li key={cve.cve_id} style={{ borderBottom: j < section.cves.length - 1 ? "1px solid var(--border-2)" : "none" }}>
                        <a
                          href={`/cve/${cve.cve_id}`}
                          style={{
                            display: "flex", alignItems: "center", gap: 12,
                            padding: "10px 0",
                            textDecoration: "none", fontSize: 14,
                          }}
                        >
                          {/* Severity dot */}
                          <span style={{
                            width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                            background: ls?.color ?? "var(--slate-dim)",
                          }} />
                          <span style={{ color: "var(--text)", fontWeight: 500, fontFamily: MONO, fontSize: 13 }}>
                            {cve.cve_id}
                          </span>
                          {cve.cvss_severity && (
                            <span style={{
                              marginLeft: "auto", fontSize: 10, fontWeight: 600,
                              color: ls?.color ?? "var(--slate-dim)",
                              letterSpacing: "0.06em", fontFamily: MONO,
                            }}>
                              {cve.cvss_severity}
                            </span>
                          )}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          §8 — DOCUMENT FOOTER
          ═══════════════════════════════════════════════════════════════════ */}
      <div style={hairline} />
      <footer style={{
        marginTop: 40, marginBottom: 64,
        display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 32,
        fontSize: 13, color: "var(--text-2)",
      }}>
        <div>
          <span style={{ ...sectionLabel, marginBottom: 6, display: "block" }}>Last Modified</span>
          <span style={{ color: "var(--text)", fontWeight: 500, fontSize: 14 }}>{modifiedDate ?? "Unknown"}</span>
        </div>
        <div>
          <span style={{ ...sectionLabel, marginBottom: 6, display: "block" }}>Authoritative Source</span>
          <a href={`https://nvd.nist.gov/vuln/detail/${data.cve_id}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", fontWeight: 500, textDecoration: "none", fontSize: 14 }}>
            NVD NIST Database ↗
          </a>
        </div>
        <div style={{ marginLeft: "auto", alignSelf: "center" }}>
          <a href="/checker" style={{ color: "var(--text)", fontWeight: 500, fontSize: 14, textDecoration: "underline", textUnderlineOffset: 4, textDecorationColor: "var(--border)" }}>
            Scan Your Project →
          </a>
        </div>
      </footer>

      {/* ═══════════════════════════════════════════════════════════════════
          §9 — RECOMMENDED SECURITY TOOLS
          ═══════════════════════════════════════════════════════════════════ */}
      {isCriticalOrHigh && (
        <>
          <div style={hairline} />
          <section style={{ marginTop: 40 }}>
            <div style={sectionLabel}>Recommended Security Tools</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 15, color: "var(--text)", fontWeight: 600, marginBottom: 6 }}>Vulnerability Remediation Engine</div>
                  <div style={{ fontSize: 13, color: "var(--text-2)", maxWidth: 460, lineHeight: 1.6 }}>{AFFILIATES.snyk.cta_critical(1)}</div>
                </div>
                <a href={AFFILIATES.snyk.href} target="_blank" rel="noopener noreferrer sponsored" style={{ color: "#ef4444", fontWeight: 600, fontSize: 13, textDecoration: "none", fontFamily: MONO }}>
                  {AFFILIATES.snyk.name} ↗
                </a>
              </div>
              <div style={{ ...hairline, background: "var(--border-2)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 15, color: "var(--text)", fontWeight: 600, marginBottom: 6 }}>Proactive Dependency Protection</div>
                  <div style={{ fontSize: 13, color: "var(--text-2)", maxWidth: 460, lineHeight: 1.6 }}>{AFFILIATES.socket.cta_general}</div>
                </div>
                <a href={AFFILIATES.socket.href} target="_blank" rel="noopener noreferrer sponsored" style={{ color: "var(--accent)", fontWeight: 600, fontSize: 13, textDecoration: "none", fontFamily: MONO }}>
                  {AFFILIATES.socket.name} ↗
                </a>
              </div>
            </div>
          </section>
        </>
      )}
    </article>
  );
}
