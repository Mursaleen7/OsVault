import "./globals.css";

export const metadata = {
  title: { default: "OsVault — Open Source Vulnerability Intelligence", template: "%s | OsVault" },
  description: "Real-time CVE tracking, CVSS scores, EPSS exploit probability, and CISA KEV data for npm and PyPI packages.",
  metadataBase: new URL("https://os-vault-kappa.vercel.app"),
  openGraph: {
    title: "OS-Vault Kappa",
    description: "Know every risk in your dependency tree.",
    url: "https://os-vault-kappa.vercel.app",
    type: "website",
    images: ["https://os-vault-kappa.vercel.app/og-image.png"],
  },
};

import {
  ClerkProvider,
  SignInButton,
  UserButton,
  OrganizationSwitcher,
} from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { dark } from "@clerk/themes";

async function Nav() {
  const { userId } = await auth();

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
          <a href="/checker" className="navbar-link" id="nav-checker">Scanner</a>
          <a href="/dashboard" className="navbar-link" id="nav-dashboard">Dashboard</a>
          <a href="/pricing" className="navbar-link" id="nav-pricing">Pricing</a>
          <a href="/trust" className="navbar-link" id="nav-trust">Trust</a>
          <a href="/blog" className="navbar-link" id="nav-blog">Blog</a>
          
          {/* Clerk Auth UI */}
          {!userId ? (
            <SignInButton mode="modal"><button className="btn-outline" style={{ fontSize: 13, padding: "7px 18px", cursor: "pointer" }}>Sign In</button></SignInButton>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <OrganizationSwitcher 
                hidePersonal={true}
                appearance={{ elements: { rootBox: { display: 'flex', justifyContent: 'center', alignItems: 'center' } } }}
              />
              <UserButton />
            </div>
          )}

          <a
            href="https://github.com/apps/osvault-security"
            className="btn-primary"
            id="nav-install-btn"
            target="_blank"
            rel="noopener noreferrer"
          >
            Install GitHub App
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
            <a href="/dashboard">Dashboard</a>
            <a href="/pricing">Pricing</a>
            <a href="https://github.com/apps/osvault-security" target="_blank" rel="noopener noreferrer">GitHub App</a>
          </div>
          <div className="footer-col">
            <h4>Platform</h4>
            <a href="/trust">Trust Center</a>
            <a href="https://nvd.nist.gov" target="_blank" rel="noopener noreferrer">NVD</a>
            <a href="https://osv.dev" target="_blank" rel="noopener noreferrer">OSV.dev</a>
            <a href="https://www.first.org/epss/" target="_blank" rel="noopener noreferrer">FIRST EPSS</a>
          </div>
          <div className="footer-col">
            <h4>Company</h4>
            <a href="https://github.com/Mursaleen7/OsVault" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="mailto:security@osvault.dev">Contact</a>
          </div>
          <div className="footer-col">
            <h4>Legal</h4>
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
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
    <ClerkProvider appearance={{ baseTheme: dark, variables: { colorPrimary: '#E63946' } }}>
      <html lang="en">
        <body>
          <Nav />
          {children}
          <Footer />
        </body>
      </html>
    </ClerkProvider>
  );
}
