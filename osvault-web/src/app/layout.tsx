import "./globals.css";

export const metadata = {
  title: { default: "OsVault — Open Source Vulnerability Intelligence", template: "%s | OsVault" },
  description: "Real-time CVE tracking, CVSS scores, EPSS exploit probability, and CISA KEV data for npm and PyPI packages.",
  metadataBase: new URL("https://os-vault-kappa.vercel.app"),
};

function Nav() {
  return (
    <nav className="navbar" id="navbar">
      <div className="navbar-inner">
        <a href="/" className="navbar-logo" id="nav-logo">
          <span className="navbar-logo-icon">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="2" width="28" height="28" rx="6" stroke="#E63946" strokeWidth="2.5" fill="none" />
              <rect x="8" y="8" width="16" height="16" rx="3" stroke="#E63946" strokeWidth="2" fill="none" />
              <circle cx="16" cy="16" r="3" fill="#E63946" />
            </svg>
          </span>
          OsVault
        </a>
        <div className="navbar-right">
          <a href="/checker" className="navbar-link" id="nav-checker">Checker</a>
          <a href="/checker" className="btn-primary" id="nav-scan-btn">
            Scan Dependencies
          </a>
        </div>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-inner">
          <div className="footer-logo">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
              <rect x="2" y="2" width="28" height="28" rx="6" stroke="#E63946" strokeWidth="2.5" fill="none" />
              <rect x="8" y="8" width="16" height="16" rx="3" stroke="#E63946" strokeWidth="2" fill="none" />
              <circle cx="16" cy="16" r="3" fill="#E63946" />
            </svg>
            OsVault
          </div>
          <div className="footer-col">
            <h4>Product</h4>
            <a href="/checker">Dependency Scanner</a>
            <a href="/">CVE Browser</a>
          </div>
          <div className="footer-col">
            <h4>Data Sources</h4>
            <a href="https://nvd.nist.gov" target="_blank" rel="noopener noreferrer">NVD</a>
            <a href="https://osv.dev" target="_blank" rel="noopener noreferrer">OSV.dev</a>
            <a href="https://www.first.org/epss/" target="_blank" rel="noopener noreferrer">FIRST EPSS</a>
          </div>
          <div className="footer-col">
            <h4>Legal</h4>
            <a href="#">Privacy Policy</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span className="footer-copy">© 2026 OsVault. Real-time vulnerability intelligence.</span>
          <span className="footer-badge">ALL SYSTEMS SECURE</span>
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
