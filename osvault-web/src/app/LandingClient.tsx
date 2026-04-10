"use client";

import { useEffect, useRef, useState } from "react";

/* ── Types ── */
const SEV_COLOR: Record<string, string> = {
  CRITICAL: "#ef4444", HIGH: "#f97316", MEDIUM: "#eab308", LOW: "#22c55e",
};

interface VulnRow {
  cve_id: string;
  description: string | null;
  cvss_score: number | null;
  cvss_severity: string | null;
  combined_risk_score: number | null;
  published_at: string | null;
}

interface Props {
  stats: { nvd: number; osv: number; kev: number };
  recent: VulnRow[];
}

/* ── Scroll Reveal ── */
function Reveal({ children, className = "", delay = 0 }: {
  children: React.ReactNode; className?: string; delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { 
        if (e.isIntersecting) { 
          setIsVisible(true); 
          io.disconnect(); 
        } 
      },
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div 
      ref={ref} 
      className={`reveal ${isVisible ? "visible" : ""} ${delay ? `reveal-delay-${delay}` : ""} ${className}`.trim()}
    >
      {children}
    </div>
  );
}

/* ── Typing Effect ── */
function TerminalTyping({ text, delay = 2000 }: { text: string; delay?: number }) {
  const [displayed, setDisplayed] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    let i = 0;
    const iv = setInterval(() => {
      if (i <= text.length) { setDisplayed(text.slice(0, i)); i++; }
      else clearInterval(iv);
    }, 45);
    return () => clearInterval(iv);
  }, [started, text]);

  return <span>{displayed}<span className="terminal-cursor" /></span>;
}

/* ── Interactive Terminal ── */
function InteractiveTerminal() {
  const [booted, setBooted] = useState(false);
  const termRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = termRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setBooted(true); io.disconnect(); } },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="terminal" ref={termRef}>
      {/* Title bar */}
      <div className="terminal-bar" style={{ position: "relative" }}>
        <div className="terminal-bar-left">
          <div className="terminal-dot terminal-dot-red" />
          <div className="terminal-dot terminal-dot-yellow" />
          <div className="terminal-dot terminal-dot-green" />
        </div>
        <div className="terminal-bar-title">OSVAULT://LOCALHOST · ACTIVE</div>
        <div className="terminal-bar-indicator" />
      </div>

      {/* Body */}
      <div className="terminal-body">
        {booted && (
          <>
            {/* Init command */}
            <div className="terminal-line terminal-line-red term-delay-0">
              <span className="terminal-lambda">λ</span> osvault init
            </div>

            {/* ASCII art */}
            <pre className="terminal-ascii terminal-line term-delay-ascii">{`
  ██████╗ ███████╗██╗   ██╗ █████╗ ██╗   ██╗██╗  ████████╗
 ██╔═══██╗██╔════╝██║   ██║██╔══██╗██║   ██║██║  ╚══██╔══╝
 ██║   ██║███████╗██║   ██║███████║██║   ██║██║     ██║
 ██║   ██║╚════██║╚██╗ ██╔╝██╔══██║██║   ██║██║     ██║
 ╚██████╔╝███████║ ╚████╔╝ ██║  ██║╚██████╔╝███████╗██║
  ╚═════╝ ╚══════╝  ╚═══╝  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝`}
            </pre>

            {/* Boot lines */}
            <div className="terminal-line term-delay-1">
              &gt; Scanning data sources...
            </div>
            <div className="terminal-line term-delay-2">
              &gt; Found NVD · OSV.dev · FIRST EPSS · CISA KEV
            </div>
            <div className="terminal-line term-delay-3">
              &gt; Loading ingest pipeline <span className="term-badge term-badge-ok">OK</span>
            </div>
            <div className="terminal-line term-delay-4">
              &gt; Indexing <span className="terminal-line-white">4,218</span> CVEs · <span className="terminal-line-white">12,847</span> advisories
            </div>

            {/* Spacer */}
            <div className="terminal-spacer terminal-line term-delay-5" />

            {/* Ready status */}
            <div className="terminal-line terminal-ready term-delay-5">
              <span className="terminal-ready-check">✓</span>
              <span className="terminal-line-green" style={{ fontWeight: 600 }}>Ready.</span>
              <span className="terminal-line-dim">
                Telemetry: <span className="term-badge term-badge-off">OFF</span>
                {" · "}
                Tracking: <span className="term-badge term-badge-off">OFF</span>
              </span>
            </div>

            {/* Spacer */}
            <div className="terminal-spacer terminal-line term-delay-6" />

            {/* Typing prompt */}
            <div className="terminal-line terminal-line-red term-delay-7">
              <span className="terminal-lambda">λ</span>{" "}
              <TerminalTyping text="scan --file package.json --report pdf" delay={4200} />
            </div>
          </>
        )}
      </div>

      {/* Status bar */}
      <div className="terminal-status-bar">
        <span>INGEST ENGINE</span>
        <div className="terminal-status-bar-center">
          <div className="terminal-status-dot" />
          <span>OV-100</span>
        </div>
        <span>SECURE SCAN</span>
      </div>
    </div>
  );
}

/* ── Ticker ── */
const TICKER = [
  "REAL-TIME CVE TRACKING", "CVSS + EPSS + KEV SCORING",
  "NPM & PYPI ECOSYSTEMS", "DAILY NVD INGESTION",
  "OPEN SOURCE INTELLIGENCE", "DEPENDENCY SCANNING",
  "100% FREE VULNERABILITY DATA", "AUTOMATED RISK SCORING",
];

function Ticker() {
  const items = [...TICKER, ...TICKER];
  return (
    <div className="hero-ticker">
      <div className="hero-ticker-track">
        {items.map((t, i) => <span key={i}>• {t} </span>)}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   LANDING
   ═══════════════════════════════════════ */
export default function LandingClient({ stats, recent }: Props) {
  useEffect(() => {
    const nav = document.getElementById("navbar");
    if (!nav) return;
    const fn = () => nav.classList.toggle("scrolled", window.scrollY > 50);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <main>

      {/* ═══ HERO ═══ */}
      <section className="hero" id="hero">
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-grid-bg" aria-hidden="true" />
        <div className="hero-noise" aria-hidden="true" />

        <div className="hero-split">
          {/* Left: Copy */}
          <div className="hero-left">
            <Reveal>
              <div className="hero-pill">
                <span className="hero-pill-dot" />
                Tracking {(stats.nvd + stats.osv).toLocaleString()}+ CVEs live
              </div>
            </Reveal>
            <Reveal>
              <h1 className="hero-h1">
                Know every risk in<br/>
                <span className="hero-h1-accent">your dependency tree.</span>
              </h1>
            </Reveal>
            <Reveal delay={1}>
              <p className="hero-sub">
                OsVault scans your npm and PyPI packages against NVD, OSV.dev,
                EPSS, and CISA KEV — combining everything into one risk score
                so you fix what actually matters.
              </p>
            </Reveal>
            <Reveal delay={2}>
              <div className="hero-ctas">
                <a href="/checker" className="btn-primary" id="hero-scan-btn">
                  Scan your dependencies
                  <span className="btn-arrow">→</span>
                </a>
                <a href="#how-it-works" className="btn-ghost" id="hero-approach-btn">How it works</a>
              </div>
            </Reveal>
            <Reveal delay={2}>
              <div className="hero-proof">
                <div className="hero-proof-item">
                  <span className="hero-proof-value">{(stats.nvd + stats.osv).toLocaleString()}</span>
                  <span className="hero-proof-label">CVEs indexed</span>
                </div>
                <div className="hero-proof-divider" />
                <div className="hero-proof-item">
                  <span className="hero-proof-value">4</span>
                  <span className="hero-proof-label">Intel sources</span>
                </div>
                <div className="hero-proof-divider" />
                <div className="hero-proof-item">
                  <span className="hero-proof-value">24h</span>
                  <span className="hero-proof-label">Refresh cycle</span>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Right: Live Dependency Graph */}
          <div className="hero-right">
            <div className="hero-graph-wrapper">
              {/* Ambient glow behind graph */}
              <div className="graph-ambient" />

              <svg className="hero-graph" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="rgba(230,57,70,0.15)" />
                    <stop offset="100%" stopColor="transparent" />
                  </radialGradient>
                  <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(230,57,70,0.25)" />
                    <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
                  </linearGradient>
                  <linearGradient id="lineGradR" x1="100%" y1="0%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="rgba(230,57,70,0.25)" />
                    <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
                  </linearGradient>
                  <filter id="softGlow">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  <filter id="nodeGlow">
                    <feGaussianBlur stdDeviation="8" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>

                {/* Center ambient */}
                <circle cx="250" cy="250" r="120" fill="url(#centerGlow)" />

                {/* Orbit rings */}
                <circle cx="250" cy="250" r="90" stroke="rgba(230,57,70,0.06)" strokeWidth="0.8" fill="none" strokeDasharray="4 8" className="graph-orbit" />
                <circle cx="250" cy="250" r="170" stroke="rgba(255,255,255,0.03)" strokeWidth="0.8" fill="none" className="graph-orbit-2" />

                {/* Scan pulse */}
                <circle className="graph-scan-ring" cx="250" cy="250" r="30" stroke="rgba(230,57,70,0.25)" strokeWidth="1" fill="none" />

                {/* Curved connections — center to each node */}
                {[
                  "M250,250 C250,180 160,130 130,120",
                  "M250,250 C300,200 360,110 390,100",
                  "M250,250 C200,280 100,270 80,260",
                  "M250,250 C300,280 400,280 420,270",
                  "M250,250 C240,310 180,380 160,400",
                  "M250,250 C280,320 350,390 370,400",
                ].map((d, i) => (
                  <path key={`c-${i}`} d={d} stroke="rgba(255,255,255,0.06)" strokeWidth="1" fill="none" className="graph-curve" style={{ animationDelay: `${i * 0.2}s` }} />
                ))}

                {/* Sub-connections from outer nodes */}
                {[
                  "M130,120 C110,90 70,70 50,60",
                  "M130,120 C90,130 50,150 35,160",
                  "M390,100 C410,70 440,50 460,45",
                  "M390,100 C420,120 450,140 465,150",
                  "M80,260 C50,280 30,320 25,340",
                  "M420,270 C450,290 470,320 475,340",
                  "M160,400 C140,430 120,450 110,460",
                  "M370,400 C390,430 410,450 425,458",
                ].map((d, i) => (
                  <path key={`sc-${i}`} d={d} stroke="rgba(255,255,255,0.035)" strokeWidth="0.8" fill="none" className="graph-curve" style={{ animationDelay: `${0.8 + i * 0.1}s` }} />
                ))}

                {/* Data scan pulses */}
                {[
                  { path: "M250,250 C250,180 160,130 130,120", delay: 0 },
                  { path: "M250,250 C300,200 360,110 390,100", delay: 1.5 },
                  { path: "M250,250 C200,280 100,270 80,260", delay: 3 },
                  { path: "M250,250 C300,280 400,280 420,270", delay: 4.5 },
                ].map((p, i) => (
                  <circle key={`pulse-${i}`} r="2.5" fill="var(--red)" filter="url(#softGlow)" opacity="0.8">
                    <animateMotion dur="4s" repeatCount="indefinite" begin={`${p.delay}s`} path={p.path} />
                  </circle>
                ))}

                {/* ── Center node ── */}
                <g className="graph-center-group">
                  <circle cx="250" cy="250" r="32" fill="rgba(230,57,70,0.04)" stroke="rgba(230,57,70,0.2)" strokeWidth="1" />
                  <circle cx="250" cy="250" r="20" fill="rgba(230,57,70,0.08)" stroke="rgba(230,57,70,0.35)" strokeWidth="1" className="graph-inner-ring" />
                  <circle cx="250" cy="250" r="6" fill="var(--red)" filter="url(#softGlow)" className="graph-center-dot" />
                </g>

                {/* ── Package nodes ── */}
                {[
                  { x:130, y:120, label:"express",      vuln:false },
                  { x:390, y:100, label:"next",          vuln:true  },
                  { x:80,  y:260, label:"urllib3",       vuln:false },
                  { x:420, y:270, label:"jsonwebtoken",  vuln:true  },
                  { x:160, y:400, label:"axios",         vuln:false },
                  { x:370, y:400, label:"lodash",        vuln:false },
                ].map((n, i) => (
                  <g key={`pkg-${i}`} className={`graph-node ${n.vuln ? 'graph-node-vuln' : ''}`} style={{ animationDelay: `${0.4 + i * 0.15}s` }}>
                    <circle cx={n.x} cy={n.y} r={n.vuln ? 18 : 14} fill={n.vuln ? "rgba(230,57,70,0.06)" : "rgba(255,255,255,0.02)"}
                      stroke={n.vuln ? "rgba(230,57,70,0.4)" : "rgba(255,255,255,0.08)"} strokeWidth="1" />
                    <circle cx={n.x} cy={n.y} r="3.5" fill={n.vuln ? "var(--red)" : "rgba(255,255,255,0.2)"} />
                    <text x={n.x} y={n.y + (n.vuln ? 30 : 26)} textAnchor="middle"
                      fill={n.vuln ? "rgba(230,57,70,0.7)" : "rgba(255,255,255,0.25)"}
                      fontSize="9" fontFamily="'JetBrains Mono', monospace" fontWeight="500" letterSpacing="0.03em">{n.label}</text>
                  </g>
                ))}

                {/* ── Sub-nodes (transitive deps) ── */}
                {[
                  { x:50,  y:60  },{ x:35,  y:160 },
                  { x:460, y:45  },{ x:465, y:150 },
                  { x:25,  y:340 },{ x:475, y:340 },
                  { x:110, y:460 },{ x:425, y:458 },
                ].map((n, i) => (
                  <g key={`sub-${i}`} className="graph-sub" style={{ animationDelay: `${1.2 + i * 0.1}s` }}>
                    <circle cx={n.x} cy={n.y} r="6" fill="rgba(255,255,255,0.015)" stroke="rgba(255,255,255,0.05)" strokeWidth="0.6" />
                    <circle cx={n.x} cy={n.y} r="2" fill="rgba(255,255,255,0.1)" />
                  </g>
                ))}

                {/* Center label */}
                <text x="250" y="295" textAnchor="middle" fill="rgba(230,57,70,0.5)" fontSize="7" fontFamily="'JetBrains Mono', monospace" fontWeight="700" letterSpacing="0.15em">SCANNER</text>
              </svg>


            </div>
          </div>
        </div>

        <Ticker />
      </section>

      {/* ═══ THE PROBLEM ═══ */}
      <section className="section section-glow-right" id="the-problem">
        <div className="container">
          <Reveal>
            <div className="section-eyebrow">
              <span className="section-eyebrow-icon" style={{ color: "var(--red)" }}>✕</span>
              THE PROBLEM
            </div>
          </Reveal>
          <Reveal>
            <h2 className="section-headline">
              You don&apos;t know what&apos;s hiding<br />in your dependencies.
            </h2>
          </Reveal>

          <div className="problem-grid">
            {[
              { ey: "BLIND SPOTS", t: "Undiscovered CVEs",
                d: "New vulnerabilities are published daily across npm and PyPI. Without continuous monitoring, critical CVEs slip through unnoticed in your dependency tree." },
              { ey: "FALSE CONFIDENCE", t: "Outdated Scoring",
                d: "CVSS alone doesn't tell the full story. Without EPSS exploit probability and CISA KEV data, you're prioritizing the wrong vulnerabilities." },
              { ey: "FRAGMENTED DATA", t: "Scattered Sources",
                d: "NVD, OSV.dev, EPSS, CISA KEV — critical intelligence is spread across dozens of sources. No single view of your actual risk posture." },
              { ey: "DELAYED RESPONSE", t: "Manual Triage",
                d: "Security teams waste hours manually cross-referencing advisories. By the time a fix is prioritized, attackers have already moved." },
            ].map((c, i) => (
              <Reveal key={c.t} delay={i + 1}>
                <div className="problem-card">
                  <div className="problem-card-eyebrow">{c.ey}</div>
                  <h3>{c.t}</h3>
                  <p>{c.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ INTRODUCING OSVAULT ═══ */}
      <section className="section intro-section section-glow-red" id="how-it-works">
        <div className="container" style={{ position: "relative" }}>
          <div className="glitch-line" style={{ top: "48%", left: 0, width: "12%" }} />
          <div className="glitch-line" style={{ top: "52%", right: 0, left: "auto", width: "12%", animationDirection: "reverse", animationDelay: "0.4s" }} />

          <Reveal>
            <div className="section-eyebrow" style={{ justifyContent: "center" }}>INTRODUCING OSVAULT</div>
          </Reveal>
          <Reveal>
            <h2 className="section-headline" style={{ textAlign: "center", margin: "0 auto 14px" }}>
              All intelligence. One platform.
            </h2>
          </Reveal>
          <Reveal>
            <p className="section-subtext" style={{ textAlign: "center", margin: "0 auto" }}>
              OsVault aggregates CVEs from NVD, advisories from OSV.dev, EPSS exploit scores,
              and CISA KEV data — computed into a unified risk score, updated daily.
            </p>
          </Reveal>

          <Reveal>
            <div className="venture-arch-diagram">
              <div className="venture-arch-grid">
                {/* SVG Connecting Lines */}
                <svg className="venture-arch-lines" viewBox="0 0 800 400" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="line-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="var(--slate-dim)" stopOpacity="0.3" />
                      <stop offset="50%" stopColor="var(--green)" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="var(--red)" stopOpacity="0.4" />
                    </linearGradient>
                    <linearGradient id="flow-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="var(--green)" stopOpacity="0" />
                      <stop offset="50%" stopColor="var(--green)" stopOpacity="1" />
                      <stop offset="100%" stopColor="var(--green)" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Top Incoming Lines */}
                  {[
                    { x1: 150, d: "M 150 60 C 150 140, 360 140, 360 200" },
                    { x1: 316, d: "M 316 60 C 316 140, 380 140, 380 200" },
                    { x1: 483, d: "M 483 60 C 483 140, 420 140, 420 200" },
                    { x1: 650, d: "M 650 60 C 650 140, 440 140, 440 200" },
                  ].map((line, i) => (
                    <g key={`top-${i}`}>
                      <path d={line.d} fill="none" stroke="url(#line-grad)" strokeWidth="1.5" />
                      <path d={line.d} fill="none" stroke="url(#flow-grad)" strokeWidth="3"
                        strokeDasharray="40 200" className="arch-flow-anim" />
                    </g>
                  ))}

                  {/* Bottom Outgoing Lines */}
                  {[
                    { d: "M 360 280 C 360 340, 200 340, 200 400" },
                    { d: "M 400 280 C 400 340, 400 340, 400 400" },
                    { d: "M 440 280 C 440 340, 600 340, 600 400" },
                  ].map((line, i) => (
                    <g key={`bot-${i}`}>
                      <path d={line.d} fill="none" stroke="url(#line-grad)" strokeWidth="1.5" />
                      <path d={line.d} fill="none" stroke="url(#flow-grad)" strokeWidth="3"
                        strokeDasharray="40 200" className="arch-flow-anim" />
                    </g>
                  ))}
                </svg>

                {/* Top Nodes: Sources */}
                <div className="arch-tier arch-tier-top">
                  {["NVD", "OSV.dev", "EPSS", "CISA KEV"].map(src => (
                    <div className="venture-arch-node" key={src}>
                      <span className="venture-arch-eyebrow">SOURCE</span>
                      {src}
                    </div>
                  ))}
                </div>

                {/* Center Node: Engine */}
                <div className="arch-tier arch-tier-center">
                  <div className="venture-arch-engine">
                    <div className="engine-ring engine-ring-outer" />
                    <div className="engine-ring engine-ring-inner" />
                    <div className="engine-core">
                      <span className="venture-arch-eyebrow" style={{ color: "var(--green)" }}>INGEST-RS</span>
                      <span className="engine-text">OSVAULT ENGINE</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Nodes: Outputs */}
                <div className="arch-tier arch-tier-bottom">
                  {["RISK SCORE", "CVE DATABASE", "PR CHECKS"].map(out => (
                    <div className="venture-arch-node" key={out}>
                      <span className="venture-arch-eyebrow">OUTPUT</span>
                      {out}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ REAL-TIME MONITORING ═══ */}
      <section className="section section-glow-left" id="realtime">
        <div className="container">
          <div className="split-section">
            <Reveal>
              <div className="radar-graphic">
                <div className="radar-ring" />
                <div className="radar-ring" />
                <div className="radar-ring" />
                <div className="radar-ring" />
                <div className="radar-center" />
                <div className="radar-sweep" />
                <div className="radar-node" style={{ top: "18%", left: "58%" }} />
                <div className="radar-node" style={{ top: "38%", right: "12%" }} />
                <div className="radar-node" style={{ bottom: "22%", left: "22%" }} />
                <div className="radar-node" style={{ top: "72%", right: "28%" }} />
              </div>
            </Reveal>
            <div>
              <Reveal>
                <div className="section-eyebrow">[ ◉ ] REAL-TIME MONITORING</div>
              </Reveal>
              <Reveal>
                <h2 className="section-headline">Track threats<br />as they emerge.</h2>
              </Reveal>
              <Reveal>
                <p className="section-subtext">
                  OsVault ingests vulnerabilities daily from NVD and OSV.dev, enriches them
                  with EPSS exploit probability and CISA KEV membership, and computes a
                  combined risk score — so you know exactly what to fix first.
                </p>
              </Reveal>
            </div>
          </div>

          <div className="three-col-grid">
            {[
              { t: "Unified risk scoring", d: "CVSS severity, EPSS exploit probability, and CISA KEV status combined into a single 0–100 score." },
              { t: "Multi-source intelligence", d: "Pull from NVD, OSV.dev, FIRST EPSS, and CISA KEV — every critical source in one pipeline." },
              { t: "Daily ingestion", d: "Automated Rust-based pipeline runs every 24 hours, ensuring you never miss a newly published CVE." },
            ].map((c, i) => (
              <Reveal key={c.t} delay={i + 1}>
                <div className="three-col-card">
                  <h3>{c.t}</h3>
                  <p>{c.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SCORING ═══ */}
      <section className="section section-glow-right" id="scoring">
        <div className="container">
          <div className="split-section">
            <div>
              <Reveal><div className="section-eyebrow">SCORING ACCURACY</div></Reveal>
              <Reveal><h2 className="section-headline">Context<br />beats severity.</h2></Reveal>
              <Reveal>
                <p className="section-subtext" style={{ marginBottom: 20 }}>
                  A CVSS 9.8 that nobody exploits is less urgent than a CVSS 7.2 actively
                  used in the wild. OsVault combines CVSS with EPSS exploit probability and
                  CISA KEV data to give you actionable prioritization.
                </p>
                <p className="section-subtext">
                  Every vulnerability is enriched with real-world exploit intelligence —
                  not just theoretical severity. Stop chasing noise. Fix what matters.
                </p>
              </Reveal>
            </div>
            <Reveal>
              <div className="perf-card">
                <div className="perf-card-title">SCORING APPROACH</div>
                <div className="perf-bar-group">
                  <div className="perf-bar-label">
                    <span style={{ color: "var(--white-pure)" }}>OsVault Combined Score</span>
                    <span className="mono" style={{ color: "var(--green)", fontSize: 12 }}>100%</span>
                  </div>
                  <div className="perf-bar-track">
                    <div className="perf-bar-fill perf-bar-fill-green" style={{ width: "100%" }} />
                  </div>
                </div>
                <div className="perf-bar-group">
                  <div className="perf-bar-label">
                    <span style={{ color: "var(--white-pure)" }}>CVSS Only</span>
                    <span className="mono" style={{ color: "var(--red)", fontSize: 12 }}>40%</span>
                  </div>
                  <div className="perf-bar-track">
                    <div className="perf-bar-fill perf-bar-fill-red" style={{ width: "40%" }} />
                  </div>
                </div>
                <p className="mono" style={{ marginTop: 20, fontSize: 11, color: "var(--slate-dim)" }}>
                  Contextual accuracy vs. raw severity scoring
                </p>
                <div className="pixel-squares">
                  {[
                    { w: 6, h: 6, top: "12%", right: "-16px", delay: "0s" },
                    { w: 10, h: 10, top: "34%", right: "-24px", delay: "1.2s" },
                    { w: 5, h: 5, top: "62%", right: "-8px", delay: "2.4s" },
                    { w: 8, h: 8, top: "22%", left: "-12px", delay: "1.8s" },
                    { w: 5, h: 5, top: "72%", left: "-14px", delay: "3s" },
                  ].map((sq, i) => (
                    <div key={i} className="pixel-square" style={{
                      width: sq.w, height: sq.h, top: sq.top, right: sq.right, left: sq.left, animationDelay: sq.delay,
                    }} />
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══ CAPABILITIES ═══ */}
      <section className="section section-glow-red" id="capabilities">
        <div className="container">
          <Reveal>
            <h2 className="section-headline" style={{ textAlign: "center" }}>
              Your dependencies, secured.
            </h2>
          </Reveal>

          <div className="cap-grid">
            {[
              { n: "01", t: "Understands your ecosystem",
                d: "Full support for npm and PyPI — the two largest open-source ecosystems. Every advisory tracked and enriched." },
              { n: "02", t: "EPSS exploit probability",
                d: "See how likely a vulnerability is to be exploited in the wild, based on real-world threat data from FIRST." },
              { n: "03", t: "CISA KEV cross-reference",
                d: "Instantly know if a CVE is in the CISA Known Exploited Vulnerabilities catalog — the gold standard for active threats." },
              { n: "04", t: "GitHub PR security checks",
                d: "Install the GitHub App and get automatic security check runs on every PR that touches your dependency files." },
              { n: "05", t: "Instant dependency scan",
                d: "Paste your package.json or requirements.txt to get a security grade, risk breakdown, and downloadable PDF report." },
              { n: "06", t: "Combined risk scoring",
                d: "Proprietary 0–100 score combining CVSS severity, EPSS probability, and KEV status into a single actionable metric." },
            ].map((c, i) => (
              <Reveal key={c.n} delay={(i % 3) + 1}>
                <div className="cap-card" id={`cap-card-${c.n}`}>
                  <div className="cap-card-num">[ {c.n} ]</div>
                  <h3>{c.t}</h3>
                  <p>{c.d}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <div className="stats-row">
              <div className="stats-item">
                <div className="stats-item-value">{(stats.nvd + stats.osv).toLocaleString()}</div>
                <div className="stats-item-label">VULNERABILITIES</div>
              </div>
              <div className="stats-item">
                <div className="stats-item-value">100%</div>
                <div className="stats-item-label">FREE &amp; OPEN</div>
              </div>
              <div className="stats-item">
                <div className="stats-item-value">{stats.kev.toLocaleString()}</div>
                <div className="stats-item-label">KEV ENTRIES</div>
              </div>
              <div className="stats-item">
                <div className="stats-item-value">24h</div>
                <div className="stats-item-label">INGESTION CYCLE</div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ TERMINAL ═══ */}
      <section className="section section-glow-left" id="terminal-section">
        <div className="container">
          <Reveal>
            <h2 className="section-headline" style={{ textAlign: "center", marginBottom: 12 }}>
              Built for security engineers.
            </h2>
          </Reveal>
          <Reveal>
            <p className="section-subtext" style={{ textAlign: "center", margin: "0 auto 48px" }}>
              From automated ingestion pipelines to instant dependency scanning —
              built with the tools you trust.
            </p>
          </Reveal>
          <Reveal>
            <InteractiveTerminal />
          </Reveal>
        </div>
      </section>

      {/* ═══ RECENT CVEs ═══ */}
      <section className="section section-glow-right" id="recent-cves">
        <div className="container">
          <Reveal>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>
                Recent Critical &amp; High CVEs
              </h2>
              <span className="mono" style={{ fontSize: 11, color: "var(--slate-dim)" }}>
                Updated daily at 5 AM UTC
              </span>
            </div>
          </Reveal>
          <div style={{ display: "grid", gap: 8 }}>
            {recent.map((v, i) => (
              <Reveal key={v.cve_id} delay={(i % 3) + 1}>
                <a href={`/cve/${v.cve_id}`} className="cve-list-card" id={`cve-card-${v.cve_id}`}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{v.cve_id}</span>
                        <span className="mono" style={{
                          fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 3,
                          background: `${SEV_COLOR[v.cvss_severity ?? ""] ?? "#374151"}18`,
                          color: SEV_COLOR[v.cvss_severity ?? ""] ?? "var(--text-2)",
                          border: `1px solid ${SEV_COLOR[v.cvss_severity ?? ""] ?? "#374151"}30`,
                        }}>
                          {v.cvss_severity}
                        </span>
                      </div>
                      <p style={{ fontSize: 12.5, color: "var(--slate)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {v.description?.slice(0, 120) ?? "No description"}
                      </p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: SEV_COLOR[v.cvss_severity ?? ""] ?? "var(--text)", letterSpacing: "-0.02em" }}>
                        {v.cvss_score}
                      </div>
                      <div className="mono" style={{ fontSize: 9, color: "var(--slate-dim)", letterSpacing: "0.08em" }}>CVSS</div>
                    </div>
                  </div>
                </a>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="section waitlist-section section-glow-left" id="waitlist">
        <div className="container">
          <Reveal><h2 className="section-headline">Start scanning today.</h2></Reveal>
          <Reveal>
            <p className="section-subtext" style={{ margin: "0 auto", textAlign: "center" }}>
              Paste your package.json or requirements.txt and get a full security report — completely free.
            </p>
          </Reveal>
          <Reveal>
            <div className="waitlist-form">
              <a href="/checker" className="waitlist-submit" id="cta-scan-btn"
                style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
                SCAN DEPENDENCIES →
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="section faq-section section-glow-red" id="faq">
        <div className="container">
          <Reveal><h2 className="section-headline">Frequently asked questions.</h2></Reveal>
          <div className="faq-list">
            {[
              { q: "What data sources does OsVault use?",
                a: "OsVault aggregates data from the National Vulnerability Database (NVD) for CVE details and CVSS scores, OSV.dev for npm and PyPI advisories, FIRST EPSS for exploit probability scores, and the CISA Known Exploited Vulnerabilities (KEV) catalog." },
              { q: "How often is the data updated?",
                a: "Our Rust-based ingestion pipeline runs daily via CI, fetching the last 24 hours of CVEs from NVD and OSV advisories. Each record is enriched with EPSS scores and CISA KEV membership in real-time." },
              { q: "What is the combined risk score?",
                a: "It's a proprietary 0–100 score that combines CVSS severity, EPSS exploit probability, and CISA KEV status into a single actionable metric. A high EPSS score or KEV membership significantly boosts the combined score." },
              { q: "Is OsVault free?",
                a: "Yes. The CVE browser, dependency scanner, and security grading are completely free to use. The GitHub App offers 10 free PR checks per month for private repositories." },
              { q: "Which ecosystems are supported?",
                a: "Currently, OsVault supports npm (Node.js/JavaScript) and PyPI (Python) — the two largest open-source package ecosystems. More ecosystems are planned for future releases." },
            ].map((faq, i) => (
              <Reveal key={i} delay={1}>
                <div
                  className={`faq-item ${openFaq === i ? "open" : ""}`}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  id={`faq-item-${i}`}
                >
                  <div className="faq-question">
                    <div className="faq-question-left">
                      <span className="faq-quote-icon">&ldquo;</span>
                      <span className="faq-question-text">{faq.q}</span>
                    </div>
                    <span className="faq-chevron">▾</span>
                  </div>
                  <div className="faq-answer"><p>{faq.a}</p></div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="section final-cta-section" id="final-cta">
        {/* 3D Wireframe Wormhole */}
        <div className="wormhole-wrapper">
          <svg className="wormhole-svg" viewBox="0 0 1000 800" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
            {/* Horizontal latitude rings — creating the funnel depth */}
            {[
              { cy: 120, rx: 480, ry: 60, o: 0.12 },
              { cy: 180, rx: 460, ry: 70, o: 0.15 },
              { cy: 240, rx: 430, ry: 80, o: 0.18 },
              { cy: 300, rx: 390, ry: 90, o: 0.22 },
              { cy: 350, rx: 340, ry: 95, o: 0.26 },
              { cy: 395, rx: 280, ry: 90, o: 0.32 },
              { cy: 430, rx: 220, ry: 80, o: 0.38 },
              { cy: 458, rx: 160, ry: 65, o: 0.45 },
              { cy: 480, rx: 110, ry: 48, o: 0.52 },
              { cy: 498, rx: 70, ry: 32, o: 0.6 },
              { cy: 510, rx: 40, ry: 18, o: 0.5 },
              { cy: 518, rx: 18, ry: 8, o: 0.35 },
              /* Outer rim rings */
              { cy: 60,  rx: 495, ry: 45, o: 0.08 },
              { cy: 680, rx: 495, ry: 50, o: 0.1 },
              { cy: 720, rx: 490, ry: 55, o: 0.07 },
              { cy: 750, rx: 485, ry: 58, o: 0.05 },
            ].map((r, i) => (
              <ellipse key={`lat-${i}`} cx={500} cy={r.cy} rx={r.rx} ry={r.ry}
                stroke="#E63946" strokeWidth="0.8" opacity={r.o} />
            ))}

            {/* Vertical meridian lines — curving from rim to center */}
            {Array.from({ length: 24 }).map((_, i) => {
              const angle = (i / 24) * Math.PI * 2;
              const topX = (500 + Math.cos(angle) * 480).toFixed(2);
              const topY = (120 + Math.sin(angle) * 60).toFixed(2);
              const midX = (500 + Math.cos(angle) * 100).toFixed(2);
              const midY = (490 + Math.sin(angle) * 30).toFixed(2);
              const botX = (500 + Math.cos(angle) * 485).toFixed(2);
              const botY = (680 + Math.sin(angle) * 50).toFixed(2);

              const q1X = (500 + Math.cos(angle) * 200).toFixed(2);
              const q1Y = (350 + Math.sin(angle) * 50).toFixed(2);
              const q2X = (500 + Math.cos(angle) * 200).toFixed(2);
              const q2Y = (580 + Math.sin(angle) * 40).toFixed(2);

              const op1 = (0.12 + Math.abs(Math.cos(angle)) * 0.1).toFixed(3);
              const op2 = (0.08 + Math.abs(Math.cos(angle)) * 0.08).toFixed(3);

              return (
                <g key={`mer-${i}`}>
                  <path
                    d={`M ${topX} ${topY} Q ${q1X} ${q1Y} ${midX} ${midY}`}
                    stroke="#E63946" strokeWidth="0.6" opacity={op1}
                  />
                  <path
                    d={`M ${midX} ${midY} Q ${q2X} ${q2Y} ${botX} ${botY}`}
                    stroke="#E63946" strokeWidth="0.6" opacity={op2}
                  />
                </g>
              );
            })}

            {/* Center bright point */}
            <circle cx={500} cy={505} r={2} fill="#E63946" opacity={0.6} />
            <circle cx={500} cy={505} r={8} fill="none" stroke="#E63946" strokeWidth="0.5" opacity={0.3} />
          </svg>
        </div>

        <div className="container" style={{ position: "relative", zIndex: 2 }}>
          <Reveal><div className="final-cta-text">Secure your open source.</div></Reveal>
          <Reveal>
            <a href="/checker" className="btn-outline btn-outline-red" id="final-cta-btn">
              Scan Dependencies Now ↵
            </a>
          </Reveal>
          <Reveal>
            <div className="final-cta-sub">No sign-up required. No usage limits. Completely free.</div>
          </Reveal>
        </div>
      </section>

    </main>
  );
}
