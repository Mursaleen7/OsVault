import { supabase } from "@/lib/supabase";

async function getStats() {
  const [nvd, osv, kev] = await Promise.all([
    supabase.from("vulnerabilities").select("id", { count: "exact", head: true }).eq("source", "nvd"),
    supabase.from("vulnerabilities").select("id", { count: "exact", head: true }).eq("source", "osv"),
    supabase.from("vulnerabilities").select("id", { count: "exact", head: true }).eq("in_kev", true),
  ]);
  return { nvd: nvd.count ?? 0, osv: osv.count ?? 0, kev: kev.count ?? 0 };
}

async function getRecentCritical() {
  const { data } = await supabase
    .from("vulnerabilities")
    .select("cve_id, description, cvss_score, cvss_severity, combined_risk_score, published_at")
    .eq("source", "nvd")
    .in("cvss_severity", ["CRITICAL", "HIGH"])
    .order("published_at", { ascending: false })
    .limit(6);
  return data ?? [];
}

const SEV_COLOR: Record<string, string> = {
  CRITICAL: "#ef4444", HIGH: "#f97316", MEDIUM: "#eab308", LOW: "#22c55e",
};

export default async function Home() {
  const [stats, recent] = await Promise.all([getStats(), getRecentCritical()]);

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>

      {/* Hero */}
      <section style={{ padding: "80px 0 64px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 14px", borderRadius: 100, border: "1px solid var(--border-2)", fontSize: 12, color: "var(--text-2)", marginBottom: 24, background: "var(--bg-card)" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
          Updated daily · {(stats.nvd + stats.osv).toLocaleString()} vulnerabilities tracked
        </div>
        <h1 style={{ fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.1, marginBottom: 20 }}>
          Vulnerability intelligence<br />
          <span style={{ background: "linear-gradient(135deg, #6366f1, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            for every dependency
          </span>
        </h1>
        <p style={{ fontSize: 18, color: "var(--text-2)", maxWidth: 520, margin: "0 auto 36px", lineHeight: 1.7 }}>
          Real-time CVE tracking with CVSS scores, EPSS exploit probability, and CISA KEV data — for npm and PyPI packages.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/checker" style={{ padding: "12px 28px", borderRadius: "var(--radius-sm)", background: "var(--accent)", color: "#fff", fontWeight: 600, fontSize: 15 }}>
            Scan your dependencies
          </a>
          <a href={`/cve/CVE-2026-5619`} style={{ padding: "12px 28px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-2)", color: "var(--text-2)", fontSize: 15 }}>
            Browse CVEs →
          </a>
        </div>
      </section>

      {/* Stats */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 64 }}>
        {[
          { label: "CVEs from NVD", value: stats.nvd.toLocaleString(), sub: "Last 24h delta ingested daily" },
          { label: "OSV Advisories", value: stats.osv.toLocaleString(), sub: "npm + PyPI ecosystems" },
          { label: "CISA KEV Entries", value: stats.kev.toLocaleString(), sub: "Actively exploited in the wild" },
        ].map((s) => (
          <div key={s.label} style={{ padding: 24, borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg-card)" }}>
            <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 12, color: "var(--text-3)" }}>{s.sub}</div>
          </div>
        ))}
      </section>

      {/* Recent Critical */}
      <section style={{ marginBottom: 64 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>Recent Critical & High CVEs</h2>
          <span style={{ fontSize: 13, color: "var(--text-3)" }}>Updated daily at 5 AM UTC</span>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          {recent.map((v) => (
            <a key={v.cve_id} href={`/cve/${v.cve_id}`} style={{ display: "block", padding: "16px 20px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text)", transition: "border-color 0.15s, background 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-2)"; (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.background = "var(--bg-card)"; }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{v.cve_id}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: `${SEV_COLOR[v.cvss_severity ?? ""] ?? "#374151"}22`, color: SEV_COLOR[v.cvss_severity ?? ""] ?? "var(--text-2)", border: `1px solid ${SEV_COLOR[v.cvss_severity ?? ""] ?? "#374151"}44` }}>
                      {v.cvss_severity}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {v.description?.slice(0, 120) ?? "No description"}
                  </p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: SEV_COLOR[v.cvss_severity ?? ""] ?? "var(--text)" }}>{v.cvss_score}</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>CVSS</div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ marginBottom: 64, padding: 40, borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "linear-gradient(135deg, #6366f108, #818cf808)", textAlign: "center" }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 12 }}>Is your project vulnerable?</h2>
        <p style={{ color: "var(--text-2)", marginBottom: 24, fontSize: 15 }}>Paste your package.json or requirements.txt and get a security grade in seconds.</p>
        <a href="/checker" style={{ padding: "12px 32px", borderRadius: "var(--radius-sm)", background: "var(--accent)", color: "#fff", fontWeight: 600, fontSize: 15 }}>
          Run a free scan →
        </a>
      </section>

    </main>
  );
}
