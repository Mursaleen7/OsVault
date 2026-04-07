"use client";

import { useState } from "react";
import type { CheckResult } from "../api/check/route";

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------
function parsePackageJson(text: string) {
  try {
    const json = JSON.parse(text);
    const deps = { ...json.dependencies, ...json.devDependencies };
    return Object.entries(deps).map(([name, version]) => ({
      name,
      version: String(version),
      ecosystem: "npm" as const,
    }));
  } catch {
    return null;
  }
}

function parseRequirementsTxt(text: string) {
  return text
    .split("\n")
    .map(l => l.trim())
    .filter(l => l && !l.startsWith("#") && !l.startsWith("-"))
    .map(l => {
      const match = l.match(/^([A-Za-z0-9_\-\.]+)\s*([><=!~].+)?$/);
      if (!match) return null;
      return { name: match[1], version: match[2]?.trim() ?? "*", ecosystem: "PyPI" as const };
    })
    .filter(Boolean) as { name: string; version: string; ecosystem: "PyPI" }[];
}

function detectAndParse(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return parsePackageJson(trimmed);
  return parseRequirementsTxt(trimmed);
}

// ---------------------------------------------------------------------------
// Grade badge
// ---------------------------------------------------------------------------
const GRADE_COLOR: Record<string, string> = {
  A: "#16a34a", B: "#65a30d", C: "#ca8a04", D: "#ea580c", F: "#dc2626",
};

function GradeBadge({ grade }: { grade: string }) {
  return (
    <span style={{
      display: "inline-block",
      width: 64, height: 64,
      lineHeight: "64px", textAlign: "center",
      borderRadius: 8,
      background: GRADE_COLOR[grade] ?? "#6b7280",
      color: "#fff",
      fontSize: 36,
      fontWeight: 700,
    }}>{grade}</span>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function CheckerPage() {
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<CheckResult | null>(null);
  const [error, setError]     = useState<string | null>(null);

  async function handleCheck() {
    setError(null);
    setResult(null);

    const packages = detectAndParse(input);
    if (!packages || packages.length === 0) {
      setError("Could not parse input. Paste a valid package.json or requirements.txt.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packages }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
      } else {
        setResult(data);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem", fontFamily: "monospace" }}>
      <h1>Dependency Security Checker</h1>
      <p>Paste your <code>package.json</code> or <code>requirements.txt</code> below.</p>
      <p style={{ fontSize: 12, color: "#6b7280" }}>Anonymous users: 3 checks per day.</p>

      <textarea
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder={'{\n  "dependencies": {\n    "lodash": "^4.17.20"\n  }\n}'}
        rows={12}
        style={{ width: "100%", fontFamily: "monospace", fontSize: 13, padding: 8, boxSizing: "border-box" }}
      />

      <button
        onClick={handleCheck}
        disabled={loading || !input.trim()}
        style={{ marginTop: 8, padding: "8px 24px", cursor: "pointer" }}
      >
        {loading ? "Checking..." : "Check Dependencies"}
      </button>

      {error && (
        <p style={{ color: "#dc2626", marginTop: 16 }}>{error}</p>
      )}

      {result && (
        <div style={{ marginTop: 24 }}>
          {/* Summary */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
            <GradeBadge grade={result.grade} />
            <div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>Security Score: {result.score}/100</div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                {result.total_packages} packages scanned &nbsp;·&nbsp;
                {result.vulnerable_count} vulnerable &nbsp;·&nbsp;
                {result.critical_count} critical &nbsp;·&nbsp;
                {result.high_count} high
              </div>
            </div>
          </div>

          {result.vulns.length === 0 ? (
            <p style={{ color: "#16a34a" }}>✓ No known vulnerabilities found.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
                  <th style={{ padding: "6px 8px" }}>Package</th>
                  <th style={{ padding: "6px 8px" }}>ID</th>
                  <th style={{ padding: "6px 8px" }}>Severity</th>
                  <th style={{ padding: "6px 8px" }}>CVSS</th>
                  <th style={{ padding: "6px 8px" }}>Risk Score</th>
                  <th style={{ padding: "6px 8px" }}>Summary</th>
                </tr>
              </thead>
              <tbody>
                {result.vulns.map((v, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "6px 8px", fontWeight: 600 }}>{v.package}@{v.version}</td>
                    <td style={{ padding: "6px 8px" }}>
                      {v.cve_id
                        ? <a href={`/cve/${v.cve_id}`}>{v.cve_id}</a>
                        : v.osv_id ?? "—"}
                    </td>
                    <td style={{ padding: "6px 8px", color: GRADE_COLOR[severityGrade(v.cvss_severity)] }}>
                      {v.cvss_severity ?? "—"}
                    </td>
                    <td style={{ padding: "6px 8px" }}>{v.cvss_score ?? "—"}</td>
                    <td style={{ padding: "6px 8px" }}>{v.combined_risk_score ?? "—"}</td>
                    <td style={{ padding: "6px 8px", color: "#6b7280" }}>{v.summary?.slice(0, 80) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </main>
  );
}

function severityGrade(s: string | null) {
  if (s === "CRITICAL") return "F";
  if (s === "HIGH")     return "D";
  if (s === "MEDIUM")   return "C";
  return "B";
}
