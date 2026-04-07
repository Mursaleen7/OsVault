"use client";

import { useState } from "react";
import type { CheckResult, VulnMatch } from "../api/check/route";
import { AFFILIATES } from "@/lib/affiliates";
import { generatePdf } from "@/lib/generatePdf";

function parsePackageJson(text: string) {
  try {
    const json = JSON.parse(text);
    const deps = { ...json.dependencies, ...json.devDependencies };
    return Object.entries(deps).map(([name, version]) => ({ name, version: String(version), ecosystem: "npm" as const }));
  } catch { return null; }
}

function parseRequirementsTxt(text: string) {
  return text.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#") && !l.startsWith("-"))
    .map(l => { const m = l.match(/^([A-Za-z0-9_\-\.]+)\s*([><=!~].+)?$/); return m ? { name: m[1], version: m[2]?.trim() ?? "*", ecosystem: "PyPI" as const } : null; })
    .filter(Boolean) as { name: string; version: string; ecosystem: "PyPI" }[];
}

function detectAndParse(text: string) {
  const t = text.trim();
  return t.startsWith("{") ? parsePackageJson(t) : parseRequirementsTxt(t);
}

const GRADE_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  A: { color: "#22c55e", bg: "#22c55e12", border: "#22c55e30" },
  B: { color: "#84cc16", bg: "#84cc1612", border: "#84cc1630" },
  C: { color: "#eab308", bg: "#eab30812", border: "#eab30830" },
  D: { color: "#f97316", bg: "#f9731612", border: "#f9731630" },
  F: { color: "#ef4444", bg: "#ef444412", border: "#ef444430" },
};

const SEV_COLOR: Record<string, string> = {
  CRITICAL: "#ef4444", HIGH: "#f97316", MEDIUM: "#eab308", LOW: "#22c55e",
};

const PLACEHOLDER = `{
  "dependencies": {
    "lodash": "^4.17.20",
    "axios": "^0.21.0",
    "express": "^4.17.1"
  }
}`;

export default function CheckerPage() {
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<CheckResult | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [email, setEmail]         = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [unlocked, setUnlocked]   = useState(false);

  async function handleCheck() {
    setError(null); setResult(null); setUnlocked(false); setEmail("");
    const packages = detectAndParse(input);
    if (!packages?.length) { setError("Could not parse input. Paste a valid package.json or requirements.txt."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packages }) });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Something went wrong.");
      else setResult(data);
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  }

  async function handleDownload() {
    setEmailError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError("Please enter a valid email address."); return; }
    setPdfLoading(true);
    try {
      const res = await fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, result }) });
      if (!res.ok) { setEmailError("Something went wrong. Please try again."); return; }
      setUnlocked(true);
      await generatePdf(result!, email);
    } catch { setEmailError("Failed to generate report. Please try again."); }
    finally { setPdfLoading(false); }
  }

  const gs = result ? GRADE_STYLE[result.grade] ?? GRADE_STYLE.F : null;

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px 80px" }}>

      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 14px", borderRadius: 100, border: "1px solid var(--border-2)", fontSize: 12, color: "var(--text-2)", marginBottom: 16, background: "var(--bg-card)" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
          Free · 3 scans per day
        </div>
        <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 12 }}>
          Dependency Security Scanner
        </h1>
        <p style={{ fontSize: 16, color: "var(--text-2)", maxWidth: 560 }}>
          Paste your <code style={{ background: "var(--bg-card)", padding: "2px 6px", borderRadius: 4, fontSize: 13 }}>package.json</code> or <code style={{ background: "var(--bg-card)", padding: "2px 6px", borderRadius: 4, fontSize: 13 }}>requirements.txt</code> to get an instant security grade.
        </p>
      </div>

      {/* Input */}
      <div style={{ marginBottom: 24 }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={12}
          style={{
            width: "100%", fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: 13,
            padding: "16px", borderRadius: "var(--radius)", border: "1px solid var(--border)",
            background: "var(--bg-card)", color: "var(--text)", resize: "vertical", outline: "none",
            lineHeight: 1.6, boxSizing: "border-box",
          }}
          onFocus={e => { e.currentTarget.style.borderColor = "var(--accent)"; }}
          onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>Supports package.json (npm) and requirements.txt (PyPI)</span>
          <button
            onClick={handleCheck}
            disabled={loading || !input.trim()}
            style={{
              padding: "10px 28px", borderRadius: "var(--radius-sm)", border: "none",
              background: loading || !input.trim() ? "var(--border-2)" : "var(--accent)",
              color: loading || !input.trim() ? "var(--text-3)" : "#fff",
              fontWeight: 600, fontSize: 14, cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              transition: "background 0.15s",
            }}
          >
            {loading ? "Scanning..." : "Scan Dependencies"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: "var(--radius-sm)", border: "1px solid #ef444430", background: "#ef444408", color: "#ef4444", fontSize: 14, marginBottom: 24 }}>
          {error}
        </div>
      )}

      {result && gs && (
        <div style={{ marginTop: 8 }}>
          {/* Grade summary */}
          <div style={{ padding: "24px 28px", borderRadius: "var(--radius)", border: `1px solid ${gs.border}`, background: gs.bg, marginBottom: 24, display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
            <div style={{ width: 72, height: 72, borderRadius: 12, background: gs.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
              {result.grade}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>
                Security Score: <span style={{ color: gs.color }}>{result.score}/100</span>
              </div>
              <div style={{ fontSize: 14, color: "var(--text-2)", display: "flex", gap: 16, flexWrap: "wrap" }}>
                <span>{result.total_packages} packages scanned</span>
                <span style={{ color: result.vulnerable_count > 0 ? "#f97316" : "var(--text-2)" }}>{result.vulnerable_count} vulnerable</span>
                {result.critical_count > 0 && <span style={{ color: "#ef4444", fontWeight: 600 }}>{result.critical_count} critical</span>}
                {result.high_count > 0 && <span style={{ color: "#f97316", fontWeight: 600 }}>{result.high_count} high</span>}
              </div>
            </div>
          </div>

          {result.vulns.length === 0 ? (
            <div style={{ padding: 32, borderRadius: "var(--radius)", border: "1px solid #22c55e30", background: "#22c55e08", textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
              <p style={{ color: "#22c55e", fontWeight: 600 }}>No known vulnerabilities found in your dependencies.</p>
            </div>
          ) : unlocked ? (
            <VulnTable vulns={result.vulns} />
          ) : (
            <EmailGate result={result} email={email} setEmail={setEmail} onDownload={handleDownload} pdfLoading={pdfLoading} emailError={emailError} />
          )}

          {/* Affiliate CTAs */}
          {result.vulnerable_count > 0 && (
            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
              {result.critical_count > 0 && (
                <div style={{ padding: "14px 18px", borderRadius: "var(--radius)", border: "1px solid #ef444430", background: "#ef444408", fontSize: 14 }}>
                  <span style={{ color: "var(--text-2)" }}>{AFFILIATES.snyk.cta_critical(result.critical_count)}</span>{" "}
                  <a href={AFFILIATES.snyk.href} target="_blank" rel="noopener noreferrer sponsored" style={{ color: "#ef4444", fontWeight: 600 }}>Try {AFFILIATES.snyk.name} →</a>
                </div>
              )}
              <div style={{ padding: "14px 18px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg-card)", fontSize: 14 }}>
                <span style={{ color: "var(--text-2)" }}>{AFFILIATES.socket.cta_critical(result.vulnerable_count)}</span>{" "}
                <a href={AFFILIATES.socket.href} target="_blank" rel="noopener noreferrer sponsored" style={{ color: "var(--accent-2)", fontWeight: 600 }}>Try {AFFILIATES.socket.name} →</a>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function VulnTable({ vulns }: { vulns: VulnMatch[] }) {
  return (
    <div style={{ borderRadius: "var(--radius)", border: "1px solid var(--border)", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}>
            {["Package", "ID", "Severity", "CVSS", "Risk", "Summary"].map(h => (
              <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "var(--text-3)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {vulns.map((v, i) => (
            <tr key={i} style={{ borderBottom: i < vulns.length - 1 ? "1px solid var(--border)" : "none" }}>
              <td style={{ padding: "12px 14px", fontWeight: 600, fontFamily: "monospace", fontSize: 12 }}>{v.package}@{v.version}</td>
              <td style={{ padding: "12px 14px" }}>
                {v.cve_id ? <a href={`/cve/${v.cve_id}`} style={{ color: "var(--accent-2)", fontSize: 12 }}>{v.cve_id}</a> : <span style={{ color: "var(--text-3)", fontSize: 12 }}>{v.osv_id ?? "—"}</span>}
              </td>
              <td style={{ padding: "12px 14px" }}>
                {v.cvss_severity && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: `${SEV_COLOR[v.cvss_severity] ?? "#374151"}18`, color: SEV_COLOR[v.cvss_severity] ?? "var(--text-2)", border: `1px solid ${SEV_COLOR[v.cvss_severity] ?? "#374151"}30` }}>{v.cvss_severity}</span>}
              </td>
              <td style={{ padding: "12px 14px", fontWeight: 600, color: SEV_COLOR[v.cvss_severity ?? ""] ?? "var(--text)" }}>{v.cvss_score ?? "—"}</td>
              <td style={{ padding: "12px 14px", color: "var(--text-2)" }}>{v.combined_risk_score ?? "—"}</td>
              <td style={{ padding: "12px 14px", color: "var(--text-3)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.summary?.slice(0, 80) ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmailGate({ result, email, setEmail, onDownload, pdfLoading, emailError }: {
  result: CheckResult; email: string; setEmail: (v: string) => void;
  onDownload: () => void; pdfLoading: boolean; emailError: string | null;
}) {
  return (
    <div style={{ padding: "28px 32px", borderRadius: "var(--radius)", border: "1px solid var(--border-2)", background: "var(--bg-card)" }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
        {result.critical_count > 0
          ? `⚠ ${result.critical_count} critical and ${result.high_count} high severity vulnerabilities found`
          : `${result.vulnerable_count} vulnerabilit${result.vulnerable_count === 1 ? "y" : "ies"} found`}
      </div>
      <p style={{ fontSize: 14, color: "var(--text-2)", marginBottom: 20, lineHeight: 1.6 }}>
        Enter your email to unlock the full breakdown — exact package versions, upgrade paths, and a downloadable PDF report.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          type="email" placeholder="you@company.com" value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === "Enter" && onDownload()}
          style={{ flex: 1, minWidth: 220, padding: "10px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-2)", background: "var(--bg)", color: "var(--text)", fontSize: 14, outline: "none" }}
          onFocus={e => { e.currentTarget.style.borderColor = "var(--accent)"; }}
          onBlur={e => { e.currentTarget.style.borderColor = "var(--border-2)"; }}
        />
        <button
          onClick={onDownload} disabled={pdfLoading}
          style={{ padding: "10px 24px", borderRadius: "var(--radius-sm)", border: "none", background: "var(--accent)", color: "#fff", fontWeight: 600, fontSize: 14, cursor: pdfLoading ? "not-allowed" : "pointer" }}
        >
          {pdfLoading ? "Generating..." : "Download PDF Report"}
        </button>
      </div>
      {emailError && <p style={{ color: "#ef4444", fontSize: 13, marginTop: 10 }}>{emailError}</p>}
      <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 12 }}>No spam. Security updates relevant to your stack only.</p>
    </div>
  );
}
