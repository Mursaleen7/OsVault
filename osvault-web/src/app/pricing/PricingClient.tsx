"use client";

import { useState } from "react";

/* ── Tier Data ── */
const TIERS = [
  {
    name: "Developer",
    tierKey: "free",
    price: "Free",
    period: "",
    description: "For individual developers and open-source projects.",
    badge: null,
    cta: "Get Started Free",
    ctaHref: "/checker",
    highlight: false,
    features: [
      { text: "Unlimited public repo scanning", included: true },
      { text: "10 private repo checks / month", included: true },
      { text: "CVE browser & search", included: true },
      { text: "PDF security reports", included: true },
      { text: "npm & PyPI ecosystems", included: true },
      { text: "Basic reachability analysis", included: true },
      { text: "Community support", included: true },
      { text: "Dashboard & analytics", included: false },
      { text: "Slack / Jira integrations", included: false },
      { text: "SSO / SAML", included: false },
    ],
  },
  {
    name: "Team",
    tierKey: "team",
    price: "$49",
    period: "/ month",
    description: "For engineering teams shipping secure software.",
    badge: "MOST POPULAR",
    cta: "Start 14-Day Free Trial",
    ctaHref: "#",
    highlight: true,
    features: [
      { text: "Everything in Developer", included: true },
      { text: "Unlimited private repo scanning", included: true },
      { text: "Team security dashboard", included: true },
      { text: "Slack alerts for critical CVEs", included: true },
      { text: "Jira ticket auto-creation", included: true },
      { text: "Go, Java, Rust ecosystems", included: true },
      { text: "Advanced reachability analysis", included: true },
      { text: "Priority email support", included: true },
      { text: "Up to 25 seats", included: true },
      { text: "SSO / SAML", included: false },
    ],
  },
  {
    name: "Enterprise",
    tierKey: "enterprise",
    price: "Custom",
    period: "",
    description: "For organizations requiring compliance and control.",
    badge: null,
    cta: "Contact Sales",
    ctaHref: "mailto:sales@osvault.dev",
    highlight: false,
    features: [
      { text: "Everything in Team", included: true },
      { text: "Unlimited seats", included: true },
      { text: "SSO / SAML (Okta, Azure AD)", included: true },
      { text: "Role-based access control", included: true },
      { text: "Audit logs & compliance", included: true },
      { text: "PagerDuty integration", included: true },
      { text: "Dedicated API endpoints", included: true },
      { text: "Custom SLA (99.9% uptime)", included: true },
      { text: "SOC 2 / ISO 27001 readiness", included: true },
      { text: "Dedicated account manager", included: true },
    ],
  },
];

const FAQ = [
  {
    q: "Can I use OsVault for free?",
    a: "Absolutely. The Developer tier is completely free — unlimited scanning for public repos, CVE browser, PDF reports, and reachability analysis. No credit card required.",
  },
  {
    q: "How does per-seat pricing work on Team?",
    a: "The Team plan is $49/month flat for up to 25 seats. Each seat corresponds to a developer in your GitHub organization who triggers PR scans. You only pay for active seats.",
  },
  {
    q: "What counts as a 'private repo check'?",
    a: "Each time the OsVault GitHub App runs a security check on a pull request in a private repository, that counts as one check. Public repositories are always unlimited.",
  },
  {
    q: "Can I switch plans at any time?",
    a: "Yes. You can upgrade, downgrade, or cancel at any time. When upgrading, you'll get immediate access to the new features. Downgrades take effect at the next billing cycle.",
  },
  {
    q: "Do you offer discounts for startups or open-source projects?",
    a: "Yes — we offer 50% off for verified startups (under 50 employees) and free Team plans for qualifying open-source maintainers. Contact us to apply.",
  },
];

interface PricingClientProps {
  currentPlan: string | null; // e.g. "free", "team", "enterprise" or null if not logged in
}

export default function PricingClient({ currentPlan }: PricingClientProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [annual, setAnnual] = useState(false);

  return (
    <main>
      {/* ── Hero ── */}
      <section className="pricing-hero" id="pricing-hero">
        <div className="pricing-hero-glow" aria-hidden="true" />
        <div className="container">
          <div className="pricing-hero-pill">
            <span className="pricing-hero-pill-dot" />
            Simple, transparent pricing
          </div>
          <h1 className="pricing-hero-h1">
            Secure your supply chain.
            <br />
            <span className="pricing-hero-accent">Pay only for what you need.</span>
          </h1>
          <p className="pricing-hero-sub">
            Start free. Scale with your team. Enterprise-grade security at every tier.
          </p>

          {/* Annual toggle */}
          <div className="pricing-toggle">
            <span className={!annual ? "pricing-toggle-active" : ""}>Monthly</span>
            <button
              className={`pricing-toggle-switch ${annual ? "active" : ""}`}
              onClick={() => setAnnual(!annual)}
              aria-label="Toggle annual billing"
              id="pricing-toggle-btn"
            >
              <span className="pricing-toggle-thumb" />
            </button>
            <span className={annual ? "pricing-toggle-active" : ""}>
              Annual <span className="pricing-toggle-save">Save 20%</span>
            </span>
          </div>
        </div>
      </section>

      {/* ── Pricing Cards ── */}
      <section className="pricing-cards-section" id="pricing-cards">
        <div className="container">
          <div className="pricing-grid">
            {TIERS.map((tier) => {
              const isCurrentPlan = currentPlan === tier.tierKey;

              return (
                <div
                  key={tier.name}
                  className={`pricing-card ${tier.highlight ? "pricing-card-highlight" : ""} ${isCurrentPlan ? "pricing-card-current" : ""}`}
                  id={`pricing-card-${tier.name.toLowerCase()}`}
                  style={{ position: 'relative' }}
                >
                  {isCurrentPlan && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, background: 'var(--red)', color: 'white', fontSize: 12, fontWeight: 700, textAlign: 'center', padding: '4px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Current Plan
                    </div>
                  )}

                  {tier.badge && !isCurrentPlan && (
                    <div className="pricing-card-badge">{tier.badge}</div>
                  )}
                  
                  <div className="pricing-card-header" style={{ marginTop: isCurrentPlan ? 16 : 0 }}>
                    <h3 className="pricing-card-name">{tier.name}</h3>
                    <p className="pricing-card-desc">{tier.description}</p>
                  </div>
                  <div className="pricing-card-price">
                    <span className="pricing-card-amount">
                      {tier.price === "Free" || tier.price === "Custom"
                        ? tier.price
                        : annual
                        ? `$${Math.round(parseInt(tier.price.replace("$", "")) * 0.8)}`
                        : tier.price}
                    </span>
                    {tier.period && (
                      <span className="pricing-card-period">{tier.period}</span>
                    )}
                  </div>
                  
                  <a
                    href={isCurrentPlan ? "/dashboard" : tier.ctaHref}
                    className={`pricing-card-cta ${tier.highlight && !isCurrentPlan ? "pricing-card-cta-primary" : ""}`}
                    id={`pricing-cta-${tier.name.toLowerCase()}`}
                    style={isCurrentPlan ? { background: 'var(--border)', color: 'var(--text)', border: 'none' } : {}}
                  >
                    {isCurrentPlan ? "Manage Billing" : tier.cta}
                  </a>
                  
                  <ul className="pricing-card-features">
                    {tier.features.map((f, i) => (
                      <li key={i} className={f.included ? "" : "pricing-feature-disabled"}>
                        <span className="pricing-feature-icon">
                          {f.included ? "✓" : "—"}
                        </span>
                        {f.text}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Comparison Table ── */}
      <section className="pricing-compare-section" id="pricing-compare">
        <div className="container">
          <h2 className="pricing-compare-title">Feature Comparison</h2>
          <div className="pricing-compare-table-wrap">
            <table className="pricing-compare-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Developer</th>
                  <th className="pricing-compare-highlight">Team</th>
                  <th>Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Public repo scanning", "Unlimited", "Unlimited", "Unlimited"],
                  ["Private repo scanning", "10 / month", "Unlimited", "Unlimited"],
                  ["Ecosystems", "npm, PyPI", "npm, PyPI, Go, Java, Rust", "All + custom"],
                  ["Reachability analysis", "Basic", "Advanced", "Advanced + custom rules"],
                  ["Dashboard", "—", "✓", "✓"],
                  ["Slack alerts", "—", "✓", "✓"],
                  ["Jira integration", "—", "✓", "✓"],
                  ["PagerDuty", "—", "—", "✓"],
                  ["API access", "—", "Read-only", "Full read/write"],
                  ["SSO / SAML", "—", "—", "✓"],
                  ["Audit logs", "—", "—", "✓"],
                  ["RBAC", "—", "—", "✓"],
                  ["SLA", "—", "—", "99.9%"],
                  ["Support", "Community", "Priority email", "Dedicated account manager"],
                  ["Compliance", "—", "—", "SOC 2 / ISO 27001 ready"],
                ].map(([feature, dev, team, ent], i) => (
                  <tr key={i}>
                    <td>{feature}</td>
                    <td>{dev}</td>
                    <td className="pricing-compare-highlight">{team}</td>
                    <td>{ent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="pricing-faq-section" id="pricing-faq">
        <div className="container">
          <h2 className="pricing-faq-title">Frequently asked questions</h2>
          <div className="pricing-faq-list">
            {FAQ.map((faq, i) => (
              <div
                key={i}
                className={`pricing-faq-item ${openFaq === i ? "open" : ""}`}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                id={`pricing-faq-${i}`}
              >
                <div className="pricing-faq-question">
                  <span>{faq.q}</span>
                  <span className="pricing-faq-chevron">▾</span>
                </div>
                <div className="pricing-faq-answer">
                  <p>{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="pricing-bottom-cta" id="pricing-bottom-cta">
        <div className="container">
          <h2>Ready to secure your dependencies?</h2>
          <p>Start with the free tier — no credit card required.</p>
          <div className="pricing-bottom-ctas">
            <a href="/checker" className="btn-primary" id="pricing-final-scan-btn">
              Scan Dependencies Free <span className="btn-arrow">→</span>
            </a>
            <a
              href="https://github.com/apps/osvault-security"
              className="btn-outline"
              id="pricing-final-install-btn"
              target="_blank"
              rel="noopener noreferrer"
            >
              Install GitHub App
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
