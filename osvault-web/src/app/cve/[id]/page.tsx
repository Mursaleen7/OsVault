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
  fontSize: 12, fontWeight: 600 as const, color: "var(--slate-dim)",
  textTransform: "uppercase" as const, letterSpacing: "0.15em",
  fontFamily: MONO, marginBottom: 24,
};
const h2Style = {
  fontSize: 24, fontWeight: 800 as const, letterSpacing: "-0.02em",
  color: "var(--white-pure)", marginBottom: 12, lineHeight: 1.3,
  fontFamily: SANS,
};

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
  const gap = 12;
  const labelW = 160;
  const valueW = 100;
  const barW = 260;
  const totalW = labelW + barW + valueW + 24;
  const totalH = metrics.length * (barH + gap) - gap + 16;

  return (
    <svg
      viewBox={`0 0 ${totalW} ${totalH}`}
      width="100%"
      style={{ maxWidth: 640, display: "block", marginTop: 24 }}
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
              fontSize="12"
              fontFamily={MONO}
              fontWeight="600"
            >
              {m.label}
            </text>
            {/* Track */}
            <rect x={labelW} y={y + 2} width={barW} height={barH - 4} rx={4} fill="rgba(255,255,255,0.03)" />
            {/* Fill */}
            <rect x={labelW} y={y + 2} width={barFill} height={barH - 4} rx={4} fill={fill} opacity={0.9} />
            {/* Value label */}
            <text
              x={labelW + barW + 16}
              y={y + barH / 2 + 1}
              dominantBaseline="middle"
              fill={fill}
              fontSize="12"
              fontFamily={SANS}
              fontWeight="700"
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
  const r = 42;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(score / maxScore, 1);
  const offset = circumference * (1 - pct);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <svg width={100} height={100} viewBox="0 0 100 100" role="img" aria-label={`${label}: ${score}`}>
        {/* Track */}
        <circle cx={50} cy={50} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={7} />
        {/* Fill arc */}
        <circle
          cx={50} cy={50} r={r} fill="none"
          stroke={color} strokeWidth={7}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
        {/* Center score */}
        <text x={50} y={52} textAnchor="middle" dominantBaseline="middle"
          fill={color} fontSize="26" fontWeight="900" fontFamily={SANS} letterSpacing="-0.04em">
          {typeof score === "number" ? (score % 1 === 0 ? score : score.toFixed(1)) : "—"}
        </text>
      </svg>
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--slate)", textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: MONO }}>
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
  type RelatedSection = { label: string; cves: { cve_id: string; cvss_severity: string | null; description?: string }[] };
  const queries: Promise<RelatedSection>[] = [];

  if (severity) {
    queries.push(
      Promise.resolve(
        supabase.from("vulnerabilities").select("cve_id, cvss_severity, description")
          .eq("source", "nvd").eq("cvss_severity", severity)
          .neq("cve_id", currentCveId).not("cve_id", "is", null).limit(4)
      ).then(({ data }) => ({ label: `Similar ${severity} Severity Vulnerabilities`, cves: (data ?? []) as RelatedSection["cves"] }))
    );
  }

  if (publishedAt) {
    const d = new Date(publishedAt);
    const s = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
    const e = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const ml = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    queries.push(
      Promise.resolve(
        supabase.from("vulnerabilities").select("cve_id, cvss_severity, description")
          .eq("source", "nvd").gte("published_at", s).lte("published_at", e)
          .neq("cve_id", currentCveId).not("cve_id", "is", null)
          .order("published_at", { ascending: false }).limit(4)
      ).then(({ data }) => ({ label: `Other Vulnerabilities from ${ml}`, cves: (data ?? []) as RelatedSection["cves"] }))
    );
  }

  if (ecosystems.length > 0) {
    const eco = ecosystems[0];
    queries.push(
      Promise.resolve(
        supabase.from("vulnerabilities").select("cve_id, cvss_severity, description")
          .eq("source", "nvd").neq("cve_id", currentCveId)
          .not("cve_id", "is", null).not("cvss_severity", "is", null).limit(4)
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
    <main className="blog-post-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ═══════════════════════════════════════════════════════════════════
          §1 — PREMIUM HEADER
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="blog-post-header">
        <div className="blog-post-header-glow" aria-hidden="true" />
        <div className="container blog-post-container">
          {/* Breadcrumb / Top Meta */}
          <div className="blog-post-meta-top">
            <nav style={{ display: "flex", gap: 12, alignItems: "center", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              <a href="/checker" className="blog-back-link">← OSVAULT Scanner</a>
              <span style={{ color: "var(--border-2)" }}>/</span>
              <span>Advisory Report</span>
            </nav>
            <span style={{ fontSize: 13, color: "var(--slate)", letterSpacing: "0.05em" }}>
              {publishedDate || "Unknown Publish Date"}
            </span>
          </div>

          {/* Title and Badging */}
          <h1 className="blog-post-h1" style={{ marginBottom: 24 }}>{data.cve_id}</h1>
          
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16 }}>
             <span style={{
                fontSize: 12, fontWeight: 700, color: sev.color, fontFamily: MONO,
                padding: "6px 14px", borderRadius: 100, border: `1px solid ${sev.border}`,
                background: sev.bg, letterSpacing: "0.08em", textTransform: "uppercase",
             }}>
               {data.cvss_severity ?? "UNKNOWN"} SEVERITY
             </span>
             {data.in_kev && (
               <span style={{ 
                 fontSize: 12, fontWeight: 700, color: "#fca5a5", fontFamily: MONO, 
                 padding: "6px 14px", borderRadius: 100, background: "rgba(248, 113, 113, 0.1)",
                 border: "1px solid rgba(248, 113, 113, 0.2)", letterSpacing: "0.06em" 
               }}>
                 ⚠ KNOWN EXPLOITED (CISA)
               </span>
             )}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          §2 — MAIN BODY & DATA (PROSE APPLIED)
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="blog-post-content">
        <div className="container blog-post-container">
          <div className="prose">
            <h2 style={h2Style}>Executive Summary</h2>

            {hasTldr && (
              <div style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-2)",
                borderRadius: "12px",
                padding: "24px 32px",
                marginBottom: "40px",
                boxShadow: "0 4px 24px rgba(0,0,0,0.4)"
              }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {tldr.target && (
                    <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--slate-dim)", fontFamily: MONO, minWidth: 100, textTransform: "uppercase", letterSpacing: "0.1em" }}>Target Object</span>
                      <strong style={{ fontSize: 16, color: "var(--white-pure)" }}>{tldr.target}</strong>
                    </div>
                  )}
                  {tldr.versions && (
                    <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--slate-dim)", fontFamily: MONO, minWidth: 100, textTransform: "uppercase", letterSpacing: "0.1em" }}>Vn. Specifier</span>
                      <strong style={{ fontSize: 16, color: sev.color, fontFamily: MONO }}>{tldr.versions}</strong>
                    </div>
                  )}
                  {tldr.vulnType && (
                    <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--slate-dim)", fontFamily: MONO, minWidth: 100, textTransform: "uppercase", letterSpacing: "0.1em" }}>Vulnerability</span>
                      <strong style={{ fontSize: 16, color: "var(--white-pure)" }}>{tldr.vulnType}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            <p style={{ fontSize: 17, lineHeight: 1.8, color: "var(--slate)" }}>
              {data.description ?? "No expansive public description is actively mapped to this vulnerability payload yet."}
            </p>

            <h2 style={{ ...h2Style, marginTop: 64 }}>Quantitative Risk Analysis</h2>
            
            <div style={{ 
              background: "var(--bg-elevated)", 
              border: "1px solid var(--border)", 
              borderRadius: "16px",
              padding: "48px",
              marginTop: 32,
              marginBottom: 48,
              position: "relative",
              overflow: "hidden"
            }}>
              {/* Premium Gradient Ring Background effect for cards */}
              <div style={{ position: "absolute", top: -100, right: -100, width: 300, height: 300, background: `radial-gradient(circle, ${sev.color}15, transparent 70%)` }} />
              
              <div style={{ display: "flex", gap: 48, alignItems: "center", flexWrap: "wrap", position: "relative", zIndex: 2 }}>
                {data.cvss_score != null && (
                  <ScoreDonut score={data.cvss_score} maxScore={10} color={sev.color} label="CVSS v3.1 BASE" />
                )}
                {data.combined_risk_score != null && (
                  <ScoreDonut score={data.combined_risk_score} maxScore={100} color={riskColor} label="OSVAULT RISK" />
                )}
                
                {/* Horizontal Stat Table */}
                <div style={{ flex: 1, minWidth: 260, borderLeft: "1px solid var(--border-2)", paddingLeft: 40 }}>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                     {data.epss_score != null && (
                        <div>
                          <div style={{ fontSize: 11, fontFamily: MONO, color: "var(--slate-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>EPSS Probability</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: data.epss_score > 0.5 ? "#ef4444" : "var(--white-pure)" }}>
                            {(data.epss_score * 100).toFixed(1)}% <span style={{ fontSize: 13, fontWeight: 500, color: "var(--slate)" }}>(chance of exploit in 30 days)</span>
                          </div>
                        </div>
                     )}
                     {data.exploit_maturity && (
                        <div>
                          <div style={{ fontSize: 11, fontFamily: MONO, color: "var(--slate-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Exploit Maturity</div>
                          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--white-pure)" }}>{data.exploit_maturity}</div>
                        </div>
                     )}
                   </div>
                </div>
              </div>
            </div>

            {/* CVSS Bar Chart breakdown styled cleanly within prose context */}
            {data.cvss_vector && (
               <>
                 <h3 style={{ fontSize: 20, fontWeight: 700, color: "var(--white-pure)", marginTop: 40, marginBottom: 12 }}>Attack Vector Profile</h3>
                 <p style={{ fontSize: 15, color: "var(--slate)", marginBottom: 24, lineHeight: 1.6 }}>
                   The payload vectors broken down by magnitude impact and ease-of-deployment factor mapping.
                 </p>
                 <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-2)", padding: "32px 40px", borderRadius: 12, marginBottom: 24 }}>
                   <CvssBarChart metrics={cvssMetrics} />
                   <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px dashed var(--border-2)", display: "flex", gap: 16, alignItems: "center" }}>
                      <span style={{ fontSize: 11, fontFamily: MONO, color: "var(--slate-dim)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Raw Vector Array</span>
                      <code style={{ fontSize: 13, color: "var(--green)", background: "rgba(34, 197, 94, 0.1)", padding: "4px 10px", borderRadius: 6 }}>{data.cvss_vector}</code>
                   </div>
                 </div>
               </>
            )}

            {/* Affected Subcomponents Table */}
            {affectedPackages.length > 0 && (
               <>
                 <h2 style={{ ...h2Style, marginTop: 64 }}>Affected Software Subcomponents</h2>
                 <div style={{ border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden", marginTop: 24 }}>
                   <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15, textAlign: "left" }}>
                     <thead style={{ background: "var(--bg-hover)" }}>
                       <tr>
                         <th style={{ padding: "16px 24px", color: "var(--slate)", fontWeight: 600, fontSize: 12, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1px solid var(--border-2)" }}>Network</th>
                         <th style={{ padding: "16px 24px", color: "var(--slate)", fontWeight: 600, fontSize: 12, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1px solid var(--border-2)" }}>Package Target</th>
                         <th style={{ padding: "16px 24px", color: "var(--slate)", fontWeight: 600, fontSize: 12, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1px solid var(--border-2)" }}>Affected Iterations</th>
                       </tr>
                     </thead>
                     <tbody>
                       {affectedPackages.map((pkg, i) => (
                         <tr key={i} style={{ borderBottom: i !== affectedPackages.length - 1 ? "1px solid var(--border-2)" : "none", background: "var(--bg)" }}>
                           <td style={{ padding: "20px 24px", verticalAlign: "top" }}>
                             <span style={{ fontSize: 12, color: "var(--slate-dim)", fontFamily: MONO, background: "var(--bg-elevated)", padding: "4px 8px", borderRadius: "6px" }}>{pkg.ecosystem}</span>
                           </td>
                           <td style={{ padding: "20px 24px", verticalAlign: "top" }}>
                             <strong style={{ fontWeight: 600, color: "var(--white-pure)" }}>
                               {pkg.ecosystem?.toLowerCase() === "npm"
                                 ? <a href={`/npm/${encodeURIComponent(pkg.name)}`} style={{ textDecoration: "underline", textUnderlineOffset: 4, textDecorationColor: "var(--border)" }}>{pkg.name}</a>
                                 : pkg.name}
                             </strong>
                           </td>
                           <td style={{ padding: "20px 24px", verticalAlign: "top", color: "var(--slate)", fontFamily: MONO, fontSize: 13, lineHeight: 1.7 }}>
                             {pkg.versions?.slice(0, 5).map(v => <span key={v} style={{ display: 'inline-block', background: 'var(--bg-card)', border: '1px solid var(--border-2)', padding: '2px 8px', borderRadius: 4, marginRight: 8, marginBottom: 8 }}>{v}</span>) ?? "Unspecified constraints"}
                             {(pkg.versions?.length ?? 0) > 5 && <span style={{ color: "var(--slate-dim)" }}>...+{pkg.versions!.length - 5}</span>}
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               </>
            )}

            {/* Platform Identifiers / CPE */}
            {data.cpe_list?.length > 0 && (
               <>
                 <h2 style={{ ...h2Style, marginTop: 64 }}>CPE Identifiers</h2>
                 <p style={{ fontSize: 15, color: "var(--slate)", marginBottom: 16 }}>
                   Common Platform Enumeration (CPE) names mapped to this advisory by the National Vulnerability Database.
                 </p>
                 <pre style={{ margin: 0, padding: 24, fontSize: 12, color: "var(--slate)", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, lineHeight: 1.8, overflowX: "auto" }}>
                   {data.cpe_list.slice(0, 15).join('\n')}
                   {data.cpe_list.length > 15 && `\n\n… ${data.cpe_list.length - 15} additional identifiers unlisted.`}
                 </pre>
               </>
            )}
            
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          §3 — DISCOVERY ENGINE (Related CVEs transformed to grid layout)
          ═══════════════════════════════════════════════════════════════════ */}
      {relatedSections.length > 0 && (
        <section className="blog-recent" style={{ borderTop: "1px solid var(--border-dark)", paddingTop: 80, paddingBottom: 80, background: "var(--bg-card)" }}>
          <div className="container">
            <h2 className="blog-section-title" style={{ textAlign: "center" }}>Relevant Threat Intelligence</h2>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 64, marginTop: 40 }}>
              {relatedSections.map((section, i) => (
                <div key={i}>
                  <h3 style={{ fontSize: 22, fontWeight: 700, color: "var(--white-pure)", marginBottom: 24, letterSpacing: "-0.02em" }}>
                    {section.label}
                  </h3>
                  
                  <div className="blog-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
                    {section.cves.map((cve) => {
                      const ls = SEV[cve.cvss_severity ?? ""];
                      return (
                         <a key={cve.cve_id} href={`/cve/${cve.cve_id}`} className="blog-card" style={{ display: 'flex', flexDirection: 'column' }}>
                           <div className="blog-meta" style={{ display: 'flex', justifyContent: 'space-between' }}>
                             <span className="blog-date">{cve.cve_id}</span>
                             {cve.cvss_severity && (
                               <span style={{
                                 fontSize: 10, fontWeight: 700, color: ls?.color ?? "var(--slate-dim)",
                                 padding: "4px 8px", borderRadius: 4, background: ls?.bg ?? "transparent",
                                 border: `1px solid ${ls?.border ?? "var(--border)"}`, letterSpacing: "0.1em", textTransform: "uppercase"
                               }}>
                                 {cve.cvss_severity}
                               </span>
                             )}
                           </div>
                           <p className="blog-card-excerpt" style={{ fontSize: 13, marginTop: 12, marginBottom: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                              {cve.description || "No public summary found for this threat instance."}
                           </p>
                         </a>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          §4 — FINAL CTA & ACTIONABLE ENDPOINT
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="blog-post-cta" style={{ background: "var(--bg)" }}>
        <div className="container blog-post-container" style={{ paddingBottom: 60 }}>
          <div className="blog-post-cta-inner" style={{ background: "radial-gradient(circle at right, rgba(230,57,70,0.06), transparent 50%), var(--bg-card)" }}>
            <div className="blog-post-cta-content">
               <h3>Are you affected by {data.cve_id}?</h3>
               <p style={{ marginTop: 8 }}>Integrate OsVault's static analysis engine directly into your repository to uncover unreachable downstream vulnerabilities implicitly bypassing your firewall rules.</p>
            </div>
            <a href="/checker" className="btn-primary" style={{ padding: "12px 28px", fontSize: 14 }}>Run Platform Scan →</a>
          </div>
          
          {/* Subtle footer */}
          <footer style={{
            marginTop: 40, display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 32,
            fontSize: 13, color: "var(--slate-dim)", fontFamily: MONO, letterSpacing: "0.04em"
          }}>
            <div>Last Platform Sync: <span style={{ color: "var(--slate)" }}>{modifiedDate ?? "Unknown"}</span></div>
            <div>
              <a href={`https://nvd.nist.gov/vuln/detail/${data.cve_id}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--slate)", textDecoration: "underline" }}>
                Verify Against NIST NVD Original Context
              </a>
            </div>
          </footer>
        </div>
      </section>

    </main>
  );
}
