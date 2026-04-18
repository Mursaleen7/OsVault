// TEMPORARILY COMMENTED OUT - Add Clerk keys to enable auth
// import { auth, clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { AnimatedCounter } from "@/components/AnimatedCounter";

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#22c55e",
};

function formatTimeAgo(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

export default async function DashboardPage() {
  // TEMPORARILY DISABLED - Add Clerk keys to enable auth
  const orgId = null;
  const userId = null;
  // const { orgId, userId } = await auth();

  // If no user/org ID is assigned, or we cannot verify the auth context, 
  // return an empty state or prompt them to establish an organization.
  if (!orgId) {
    return (
      <main className="dash-main">
        <section className="dash-header-section" style={{ minHeight: "60vh", display: "flex", alignItems: "center" }}>
          <div className="container" style={{ textAlign: "center" }}>
            <h1 className="dash-header-title" style={{ marginBottom: 16 }}>Welcome to OsVault</h1>
            <p className="dash-header-sub" style={{ marginBottom: 32 }}>
              Please select or create an Organization in your account menu to view your security posture.
            </p>
          </div>
        </section>
      </main>
    );
  }

  // 1. Resolve Organization from Supabase using Clerk's orgId as the slug or identifier.
  // We use `.maybeSingle()` in case the org hasn't synced to our DB yet.
  const { data: orgData } = await supabase
    .from("organizations")
    .select("id, name, plan, github_org_id")
    .eq("slug", orgId)
    .maybeSingle();

  const internalOrgId = orgData?.id;
  const orgName = orgData?.name || "Your Organization";
  const plan = orgData?.plan || "free";

  // 2. Fetch Metrics (Aggregate from scan_results for the last 30 days)
  let reposProtected = 0;
  let totalScansThisMonth = 0;
  let reachableBlocked = 0;
  let bypassedSafe = 0;
  let openCritical = 0;
  let openHigh = 0;
  let openMedium = 0;

  let recentScans: any[] = [];
  let topCves: any[] = [];
  let integrations = [
    { name: "GitHub App", status: "not_connected", icon: "🐙" },
    { name: "Slack", status: "not_connected", icon: "💬" },
    { name: "Jira", status: "not_connected", icon: "📋" },
    { name: "PagerDuty", status: "not_connected", icon: "🔔" },
  ];

  if (internalOrgId) {
    // 30 days ago
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch all recent scans
    const { data: scans } = await supabase
      .from("scan_results")
      .select("*")
      .eq("organization_id", internalOrgId)
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false });

    if (scans && scans.length > 0) {
      totalScansThisMonth = scans.length;
      
      // Calculate active repos vs unique repos
      const uniqueRepos = new Set(scans.map(s => s.repo));
      reposProtected = uniqueRepos.size;

      // Calculate totals
      for (const scan of scans) {
        reachableBlocked += (scan.reachable_vulns || 0);
        bypassedSafe += (scan.bypassed_vulns || 0);
      }

      // Open severities logic - ideally we'd track unresolved states, 
      // but for this dashboard we'll sum the metrics from the absolute latest scan for each repo
      const latestPerRepo = new Map();
      for (const scan of scans) {
        if (!latestPerRepo.has(scan.repo)) {
          latestPerRepo.set(scan.repo, scan);
          openCritical += (scan.critical_count || 0);
          openHigh += (scan.high_count || 0);
          // Fallbacks for low/medium if missing
          openMedium += Math.floor((scan.total_vulns - scan.critical_count - scan.high_count) * 0.7); 
        }
      }

      // Get the 6 most recent scans for the feed
      recentScans = scans.slice(0, 6).map(s => ({
        repo: s.repo,
        pr: s.pr_number || 0,
        vulns: s.total_vulns || 0,
        reachable: s.reachable_vulns || 0,
        status: s.conclusion === "success" ? "passed" : "failed",
        time: formatTimeAgo(s.created_at)
      }));
    }

    // Fetch integration statuses
    const { data: intgs } = await supabase
      .from("integration_configs")
      .select("provider, enabled")
      .eq("organization_id", internalOrgId);

    if (intgs) {
      for (const intg of intgs) {
        const item = integrations.find(i => i.name.toLowerCase().includes(intg.provider.toLowerCase()));
        if (item && intg.enabled) item.status = "connected";
      }
    }
    
    // Check if GitHub org is linked directly
    if (orgData.github_org_id) {
      const gh = integrations.find(i => i.name === "GitHub App");
      if (gh) gh.status = "connected";
    }

    // Determine noise reduction rate
    const noiseReductionRate = (reachableBlocked + bypassedSafe) > 0 
      ? Math.round((bypassedSafe / (reachableBlocked + bypassedSafe)) * 100)
      : 0;
  }

  // Fallback Top CVEs (System level if Org level has no specific DB linking setup yet)
  const { data: systemCves } = await supabase
    .from("vulnerabilities")
    .select("cve_id, ecosystem, cvss_score, cvss_severity")
    .order("published_at", { ascending: false })
    .limit(5);
  
  if (systemCves) {
    topCves = systemCves.map(c => ({
      id: c.cve_id || "Unknown",
      pkg: c.ecosystem || "npm",
      score: c.cvss_score || 0,
      severity: c.cvss_severity || "MEDIUM",
      repos: 0 // Would be computed natively in a real deployment via a join
    }));
  }

  const m = {
    reposProtected,
    totalScansThisMonth,
    reachableBlocked,
    bypassedSafe,
    openCritical,
    openHigh,
    openMedium,
    avgRemediationDays: 0, // Placeholder until advanced issue tracking is established
    noiseReductionRate: (reachableBlocked + bypassedSafe) > 0 
      ? Math.round((bypassedSafe / (reachableBlocked + bypassedSafe)) * 100) 
      : 100
  };

  return (
    <main className="dash-main">
      {/* ── Header ── */}
      <section className="dash-header-section">
        <div className="container">
          <div className="dash-header-top">
            <div>
              <h1 className="dash-header-title">Security Dashboard</h1>
              <p className="dash-header-sub">
                Real-time security posture for your organization.
              </p>
            </div>
            <div className="dash-header-actions">
              <span className="dash-header-org">
                <span className="dash-header-org-dot" />
                {orgName}
              </span>
              {plan === "free" && (
                <a href="/pricing" className="btn-outline dash-upgrade-btn" id="dash-upgrade-btn">
                  Upgrade Plan
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Metric Cards ── */}
      <section className="dash-metrics-section">
        <div className="container">
          <div className="dash-metrics-grid">
            <div className="dash-metric-card" id="metric-repos">
              <div className="dash-metric-eyebrow">REPOS PROTECTED</div>
              <div className="dash-metric-value">
                <AnimatedCounter target={m.reposProtected} />
              </div>
              <div className="dash-metric-trend dash-metric-trend-up">
                Active in last 30 days
              </div>
            </div>
            <div className="dash-metric-card dash-metric-card-danger" id="metric-critical">
              <div className="dash-metric-eyebrow">OPEN CRITICAL</div>
              <div className="dash-metric-value" style={{ color: "#ef4444" }}>
                <AnimatedCounter target={m.openCritical} />
              </div>
              <div className="dash-metric-trend">
                Across latest PR branch scans
              </div>
            </div>
            <div className="dash-metric-card" id="metric-scans">
              <div className="dash-metric-eyebrow">SCANS THIS MONTH</div>
              <div className="dash-metric-value">
                <AnimatedCounter target={m.totalScansThisMonth} />
              </div>
              <div className="dash-metric-trend dash-metric-trend-up">
                PRs analyzed
              </div>
            </div>
            <div className="dash-metric-card" id="metric-remediation">
              <div className="dash-metric-eyebrow">AVG. REMEDIATION</div>
              <div className="dash-metric-value">
                {m.avgRemediationDays}
                <span className="dash-metric-unit">days</span>
              </div>
              <div className="dash-metric-trend">
                Requires Jira integration
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Reachability Impact Strip ── */}
      <section className="dash-reach-section">
        <div className="container">
          <div className="dash-reach-strip">
            <div className="dash-reach-item">
              <div className="dash-reach-icon dash-reach-icon-red">🚨</div>
              <div>
                <div className="dash-reach-value">{m.reachableBlocked}</div>
                <div className="dash-reach-label">Reachable threats blocked</div>
              </div>
            </div>
            <div className="dash-reach-divider" />
            <div className="dash-reach-item">
              <div className="dash-reach-icon dash-reach-icon-green">🛡️</div>
              <div>
                <div className="dash-reach-value">{m.bypassedSafe}</div>
                <div className="dash-reach-label">False positives eliminated</div>
              </div>
            </div>
            <div className="dash-reach-divider" />
            <div className="dash-reach-item">
              <div className="dash-reach-icon dash-reach-icon-blue">📊</div>
              <div>
                <div className="dash-reach-value">{m.noiseReductionRate}%</div>
                <div className="dash-reach-label">Noise reduction rate</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Severity Breakdown ── */}
      <section className="dash-severity-section">
        <div className="container">
          <div className="dash-twocol">
            {/* Severity bar chart */}
            <div className="dash-panel" id="dash-severity-panel">
              <h3 className="dash-panel-title">Open Vulnerabilities by Severity</h3>
              {m.reposProtected === 0 ? (
                <div style={{ color: "var(--slate)", fontSize: 13 }}>No recent scans found.</div>
              ) : (
                <div className="dash-severity-bars">
                  {[
                    { label: "CRITICAL", count: m.openCritical, color: "#ef4444", max: Math.max(m.openCritical, 10) },
                    { label: "HIGH", count: m.openHigh, color: "#f97316", max: Math.max(m.openHigh, 10) },
                    { label: "MEDIUM", count: m.openMedium, color: "#eab308", max: Math.max(m.openMedium, 10) },
                    { label: "LOW", count: 0, color: "#22c55e", max: 10 },
                  ].map((s) => (
                    <div key={s.label} className="dash-severity-row">
                      <span className="dash-severity-label">{s.label}</span>
                      <div className="dash-severity-track">
                        <div
                          className="dash-severity-fill"
                          style={{
                            width: `${Math.min((s.count / s.max) * 100, 100)}%`,
                            background: s.color,
                          }}
                        />
                      </div>
                      <span className="dash-severity-count">{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Actionable CVEs */}
            <div className="dash-panel" id="dash-top-cves-panel">
              <h3 className="dash-panel-title">Platform Priority CVEs</h3>
              <div className="dash-top-cves">
                {topCves.map((cve) => (
                  <a
                    key={cve.id}
                    href={`/cve/${cve.id}`}
                    className="dash-cve-row"
                    id={`dash-cve-${cve.id}`}
                  >
                    <div className="dash-cve-left">
                      <span className="dash-cve-id">{cve.id}</span>
                      <span className="dash-cve-pkg">{cve.pkg}</span>
                    </div>
                    <div className="dash-cve-right">
                      <span
                        className="dash-cve-badge"
                        style={{
                          background: `${SEVERITY_COLORS[cve.severity]}18`,
                          color: SEVERITY_COLORS[cve.severity],
                          borderColor: `${SEVERITY_COLORS[cve.severity]}30`,
                        }}
                      >
                        {cve.score}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Recent Scans ── */}
      <section className="dash-scans-section">
        <div className="container">
          <div className="dash-panel" id="dash-recent-scans-panel">
            <div className="dash-panel-header">
              <h3 className="dash-panel-title">Recent PR Scans</h3>
              <span className="dash-panel-subtitle">Last 30 days</span>
            </div>
            {recentScans.length === 0 ? (
              <div style={{ color: "var(--slate-dim)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
                No PR scans detected for this organization yet. Install the GitHub App to begin tracking.
              </div>
            ) : (
              <div className="dash-scans-list">
                {recentScans.map((scan, i) => (
                  <div key={i} className="dash-scan-row" id={`dash-scan-${i}`}>
                    <div className="dash-scan-left">
                      <span
                        className={`dash-scan-status ${
                          scan.status === "passed"
                            ? "dash-scan-status-pass"
                            : "dash-scan-status-fail"
                        }`}
                      >
                        {scan.status === "passed" ? "✓" : "✕"}
                      </span>
                      <div>
                        <div className="dash-scan-repo">
                          {scan.repo}
                          <span className="dash-scan-pr">#{scan.pr}</span>
                        </div>
                        <div className="dash-scan-meta">
                          {scan.vulns} vuln{scan.vulns !== 1 ? "s" : ""} ·{" "}
                          {scan.reachable} reachable · {scan.time}
                        </div>
                      </div>
                    </div>
                    <div className="dash-scan-right">
                      {scan.vulns > 0 && scan.reachable > 0 ? (
                        <span className="dash-scan-badge dash-scan-badge-danger">
                          Action Required
                        </span>
                      ) : scan.vulns > 0 ? (
                        <span className="dash-scan-badge dash-scan-badge-safe">
                          All Bypassed
                        </span>
                      ) : (
                        <span className="dash-scan-badge dash-scan-badge-clean">
                          Clean
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Integration Status ── */}
      <section className="dash-integrations-section">
        <div className="container">
          <div className="dash-panel" id="dash-integrations-panel">
            <h3 className="dash-panel-title">Connected Integrations</h3>
            <div className="dash-integrations-grid">
              {integrations.map((intg) => (
                <div key={intg.name} className="dash-integration-card" id={`dash-intg-${intg.name.toLowerCase().replace(/\s/g, "-")}`}>
                  <span className="dash-integration-icon">{intg.icon}</span>
                  <div>
                    <div className="dash-integration-name">{intg.name}</div>
                    <div
                      className={`dash-integration-status ${
                        intg.status === "connected"
                          ? "dash-integration-active"
                          : ""
                      }`}
                    >
                      {intg.status === "connected" ? (
                        <>
                          <span className="dash-integration-dot" /> Connected
                        </>
                      ) : (
                        "Not connected"
                      )}
                    </div>
                  </div>
                  {intg.status !== "connected" && (
                    <button className="dash-integration-connect">Connect</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
