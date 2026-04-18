export const metadata = {
  title: "Trust Center — OsVault Security & Compliance",
  description:
    "OsVault's trust center: learn about our security architecture, compliance posture, data handling practices, and commitment to protecting your vulnerability intelligence.",
};

const CONTROLS = [
  {
    category: "Data Security",
    items: [
      { control: "Encryption at rest", status: "active", detail: "AES-256 via Supabase managed encryption" },
      { control: "Encryption in transit", status: "active", detail: "TLS 1.3 enforced on all endpoints" },
      { control: "Database isolation", status: "active", detail: "Row-Level Security (RLS) enforced per organization" },
      { control: "Secret management", status: "active", detail: "Environment variables via Vercel encrypted storage" },
    ],
  },
  {
    category: "Access Control",
    items: [
      { control: "SSO / SAML", status: "available", detail: "Enterprise plan — Okta, Azure AD, Google Workspace" },
      { control: "Role-Based Access Control", status: "available", detail: "Admin, Security Engineer, Viewer roles" },
      { control: "API key rotation", status: "active", detail: "Automatic 90-day rotation with zero-downtime" },
      { control: "MFA enforcement", status: "roadmap", detail: "Q3 2026 — TOTP and WebAuthn support" },
    ],
  },
  {
    category: "Audit & Compliance",
    items: [
      { control: "Audit logs", status: "available", detail: "Immutable, append-only logs for all dashboard actions" },
      { control: "SOC 2 Type II", status: "roadmap", detail: "Audit in progress — estimated Q4 2026" },
      { control: "ISO 27001", status: "roadmap", detail: "Certification planned post-SOC 2 completion" },
      { control: "GDPR compliance", status: "active", detail: "EU data processing, DPA available on request" },
    ],
  },
  {
    category: "Infrastructure",
    items: [
      { control: "Hosting provider", status: "active", detail: "Vercel Edge Network — SOC 2 Type II certified" },
      { control: "Database provider", status: "active", detail: "Supabase (AWS) — SOC 2 Type II certified" },
      { control: "DDoS protection", status: "active", detail: "Vercel Edge + Upstash rate limiting" },
      { control: "Uptime SLA", status: "available", detail: "99.9% guaranteed for Enterprise plans" },
    ],
  },
];

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  active: { label: "Active", cls: "trust-status-active" },
  available: { label: "Available", cls: "trust-status-available" },
  roadmap: { label: "Roadmap", cls: "trust-status-roadmap" },
};

export default function TrustCenterPage() {
  return (
    <main className="trust-main">
      {/* ── Hero ── */}
      <section className="trust-hero" id="trust-hero">
        <div className="trust-hero-glow" aria-hidden="true" />
        <div className="container">
          <div className="trust-hero-pill">
            <span className="trust-hero-pill-icon">🔒</span>
            Trust & Compliance
          </div>
          <h1 className="trust-hero-h1">
            Security is in our DNA.
          </h1>
          <p className="trust-hero-sub">
            OsVault is built with the same security rigor we help you enforce.
            Explore our architecture, compliance posture, and data handling practices.
          </p>
        </div>
      </section>

      {/* ── Architecture Overview ── */}
      <section className="trust-arch-section" id="trust-architecture">
        <div className="container">
          <h2 className="trust-section-title">Architecture Overview</h2>
          <div className="trust-arch-grid">
            {[
              {
                title: "Zero Trust Data Pipeline",
                desc: "Our Rust-based ingestion engine runs in isolated, stateless containers. It fetches data from NVD, OSV, EPSS, and CISA KEV without storing credentials on disk.",
                icon: "⚡",
              },
              {
                title: "Edge-First Deployment",
                desc: "All web traffic is served through Vercel's global edge network with automatic SSL, DDoS mitigation, and geographic routing for sub-100ms response times.",
                icon: "🌐",
              },
              {
                title: "Isolated GitHub App",
                desc: "The GitHub App is deployed as a separate, sandboxed service. It requests minimal permissions (read-only code access) and processes PR data entirely in memory.",
                icon: "🐙",
              },
              {
                title: "Encrypted Database",
                desc: "All vulnerability data and customer metadata is stored in Supabase (PostgreSQL on AWS) with AES-256 encryption at rest and TLS 1.3 in transit.",
                icon: "🗄️",
              },
            ].map((item) => (
              <div key={item.title} className="trust-arch-card">
                <span className="trust-arch-icon">{item.icon}</span>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Controls Matrix ── */}
      <section className="trust-controls-section" id="trust-controls">
        <div className="container">
          <h2 className="trust-section-title">Security Controls</h2>
          <p className="trust-section-sub">
            A detailed breakdown of every security control across OsVault&apos;s
            infrastructure, data handling, and access management layers.
          </p>
          <div className="trust-controls-grid">
            {CONTROLS.map((group) => (
              <div key={group.category} className="trust-control-group">
                <h3 className="trust-control-category">{group.category}</h3>
                <div className="trust-control-items">
                  {group.items.map((item) => {
                    const cfg = STATUS_CONFIG[item.status];
                    return (
                      <div key={item.control} className="trust-control-row">
                        <div className="trust-control-left">
                          <span className="trust-control-name">
                            {item.control}
                          </span>
                          <span className="trust-control-detail">
                            {item.detail}
                          </span>
                        </div>
                        <span className={`trust-status-badge ${cfg.cls}`}>
                          {cfg.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Data Handling ── */}
      <section className="trust-data-section" id="trust-data">
        <div className="container">
          <h2 className="trust-section-title">Data Handling</h2>
          <div className="trust-data-grid">
            {[
              {
                title: "What We Access",
                items: [
                  "PR diff content (dependency file changes only)",
                  "Repository file tree (for reachability analysis)",
                  "GitHub organization metadata",
                ],
              },
              {
                title: "What We Never Store",
                items: [
                  "Source code — analyzed in-memory, never persisted",
                  "Personal access tokens — we use GitHub App JWTs",
                  "Passwords or secrets from your codebase",
                ],
              },
              {
                title: "Retention Policy",
                items: [
                  "Scan results: 90 days (configurable on Enterprise)",
                  "Audit logs: 1 year (immutable)",
                  "Vulnerability data: Updated daily, never deleted",
                ],
              },
            ].map((col) => (
              <div key={col.title} className="trust-data-card">
                <h3>{col.title}</h3>
                <ul>
                  {col.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="trust-cta-section" id="trust-cta">
        <div className="container">
          <h2>Need more details?</h2>
          <p>
            Request our full security questionnaire, DPA, or schedule a call
            with our security team.
          </p>
          <a
            href="mailto:security@osvault.dev"
            className="btn-primary"
            id="trust-contact-btn"
          >
            Contact Security Team <span className="btn-arrow">→</span>
          </a>
        </div>
      </section>
    </main>
  );
}
