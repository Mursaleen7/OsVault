import "./globals.css";

export const metadata = {
  title: { default: "OsVault — Open Source Vulnerability Intelligence", template: "%s | OsVault" },
  description: "Real-time CVE tracking, CVSS scores, EPSS exploit probability, and CISA KEV data for npm and PyPI packages.",
  metadataBase: new URL("https://os-vault-kappa.vercel.app"),
};

function Nav() {
  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 50,
      borderBottom: "1px solid var(--border)",
      background: "rgba(10,10,15,0.85)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text)", fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em" }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#6366f1,#818cf8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#fff" }}>O</span>
          OsVault
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <a href="/checker" style={{ padding: "6px 14px", borderRadius: "var(--radius-sm)", fontSize: 13, color: "var(--text-2)", transition: "color 0.15s" }}>Checker</a>
          <a href="/checker" style={{ padding: "6px 16px", borderRadius: "var(--radius-sm)", fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#fff" }}>
            Scan Dependencies
          </a>
        </div>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--border)", marginTop: 80, padding: "32px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <span style={{ fontSize: 13, color: "var(--text-3)" }}>© 2026 OsVault. Real-time vulnerability intelligence.</span>
        <div style={{ display: "flex", gap: 20, fontSize: 13, color: "var(--text-3)" }}>
          <a href="/checker" style={{ color: "var(--text-3)" }}>Checker</a>
          <a href="https://nvd.nist.gov" target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-3)" }}>NVD</a>
          <a href="https://osv.dev" target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-3)" }}>OSV</a>
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  );
}
