"use client";

import React, { useState, useEffect } from "react";

export default function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);

  // Lock body scrolling when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  return (
    <>
      <button 
        className="mobile-menu-trigger"
        onClick={() => setIsOpen(true)}
        aria-label="Open navigation menu"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>

      <div className={`mobile-overlay ${isOpen ? "open" : ""}`}>
        <div className="mobile-overlay-header">
          <a href="/" className="navbar-logo" onClick={() => setIsOpen(false)}>
            <span className="navbar-logo-icon">
              <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="2" width="28" height="28" rx="6" stroke="#E63946" strokeWidth="2.5" fill="none" />
                <rect x="8" y="8" width="16" height="16" rx="3" stroke="#E63946" strokeWidth="2" fill="none" />
                <circle cx="16" cy="16" r="3" fill="#E63946" />
              </svg>
            </span>
            OsVault
          </a>
          <button 
            className="mobile-menu-close"
            onClick={() => setIsOpen(false)}
            aria-label="Close navigation menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <nav className="mobile-overlay-nav">
          <a href="/checker" onClick={() => setIsOpen(false)}>Dependency Scanner</a>
          <a href="/dashboard" onClick={() => setIsOpen(false)}>Dashboard</a>
          <a href="/pricing" onClick={() => setIsOpen(false)}>Pricing</a>
          <a href="/trust" onClick={() => setIsOpen(false)}>Trust Center</a>
          <a href="/blog" onClick={() => setIsOpen(false)}>Engineering Blog</a>
          
          <div className="mobile-overlay-divider"></div>
          
          <a href="/pricing" className="btn-outline mobile-nav-btn" onClick={() => setIsOpen(false)}>Sign In</a>
          <a 
            href="https://github.com/apps/osvault-security" 
            className="btn-primary mobile-nav-btn" 
            target="_blank" 
            rel="noopener noreferrer"
            onClick={() => setIsOpen(false)}
          >
            Install GitHub App
          </a>
        </nav>
      </div>
    </>
  );
}
