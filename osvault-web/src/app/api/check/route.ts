import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ---------------------------------------------------------------------------
// Rate limiter — 3 checks per day per IP
// Falls back gracefully if Upstash env vars are not set
// ---------------------------------------------------------------------------
let ratelimit: Ratelimit | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  ratelimit = new Ratelimit({
    redis: new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    }),
    limiter: Ratelimit.slidingWindow(3, "1 d"),
    analytics: false,
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface PackageDep {
  name: string;
  version: string;  // raw semver string e.g. "^1.2.3"
  ecosystem: "npm" | "PyPI";
}

export interface VulnMatch {
  package: string;
  version: string;
  osv_id: string | null;
  cve_id: string | null;
  summary: string | null;
  cvss_score: number | null;
  cvss_severity: string | null;
  combined_risk_score: number | null;
  affected_versions: string[];
}

export interface CheckResult {
  grade: "A" | "B" | "C" | "D" | "F";
  score: number;           // 0–100, higher = safer
  total_packages: number;
  vulnerable_count: number;
  critical_count: number;
  high_count: number;
  vulns: VulnMatch[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip semver range prefixes to get a bare version */
function bareVersion(v: string): string {
  return v.replace(/^[\^~>=<]+/, "").trim().split(" ")[0];
}

/** 
 * Semantic Version Chunk Comparator
 * Splits strings into numeric/aphanumeric chunks and evaluates e.g. 5.3 vs 5.4.1
 */
function compareVersions(a: string, b: string): number {
  if (a === b) return 0;
  const re = /[a-zA-Z0-9]+/g;
  const chunkA = a.match(re) || [];
  const chunkB = b.match(re) || [];

  const maxLen = Math.max(chunkA.length, chunkB.length);
  for (let i = 0; i < maxLen; i++) {
    const pA = chunkA[i];
    const pB = chunkB[i];
    
    if (pA === pB) continue;
    if (pA === undefined) return -1;
    if (pB === undefined) return 1;

    const numA = parseInt(pA, 10);
    const numB = parseInt(pB, 10);

    const isNumA = !isNaN(numA);
    const isNumB = !isNaN(numB);

    if (isNumA && isNumB) {
      if (numA !== numB) return numA > numB ? 1 : -1;
    } else if (isNumA && !isNumB) {
      return 1;
    } else if (!isNumA && isNumB) {
      return -1;
    } else {
      return pA.localeCompare(pB);
    }
  }
  return 0;
}

/**
 * Checks if a version falls within any of the pairs of [introduced, fixed) boundaries.
 */
function isVersionVulnerable(currentVer: string, bounds: string[]): boolean {
  if (!bounds || bounds.length === 0) return true; // Generic vulnerablity if no bounds

  let vulnerable = false;
  let i = 0;
  while (i < bounds.length) {
    const introduced = bounds[i];
    const fixed = i + 1 < bounds.length ? bounds[i+1] : null;

    if (compareVersions(currentVer, introduced) >= 0) {
      if (!fixed || compareVersions(currentVer, fixed) < 0) {
         vulnerable = true;
         break;
      }
    }
    i += 2;
  }
  return vulnerable;
}

/** Compute A–F grade from intelligent risk scores, not raw severity counts.
 *
 * Uses composite: 60% max-risk (worst case matters) + 40% average (breadth of exposure).
 * This ensures grades reflect the actual engine intelligence rather than
 * a disconnected penalty formula.
 */
function computeGrade(vulns: VulnMatch[]): { grade: CheckResult["grade"]; score: number } {
  if (vulns.length === 0) return { grade: "A", score: 100 };

  // Generate an intelligent fallback for unmapped vulnerabilities to prevent falling open to 100
  const SEVERITY_FALLBACK: Record<string, number> = {
    CRITICAL: 90, HIGH: 70, MEDIUM: 40, LOW: 20
  };

  const riskScores = vulns.map(v => {
    if (v.combined_risk_score !== null) return v.combined_risk_score;
    // Fallback securely so we NEVER generate A-grades for vulnerable packages
    return SEVERITY_FALLBACK[v.cvss_severity?.toUpperCase() || ""] ?? 50; 
  });
  
  const maxRisk = Math.max(...riskScores);
  const avgRisk = riskScores.reduce((s, r) => s + r, 0) / riskScores.length;

  // Composite: 60% worst-case + 40% average breadth
  const composite = 0.6 * maxRisk + 0.4 * avgRisk;
  const score = Math.max(0, Math.round(100 - composite));

  const grade: CheckResult["grade"] =
    score >= 90 ? "A" :
    score >= 75 ? "B" :
    score >= 55 ? "C" :
    score >= 35 ? "D" : "F";

  return { grade, score };
}

// ---------------------------------------------------------------------------
// POST /api/check
// Body: { packages: PackageDep[] }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  // Rate limit by IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "anonymous";
  if (ratelimit) {
    const { success, remaining } = await ratelimit.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Anonymous users are limited to 3 checks per day." },
        { status: 429, headers: { "X-RateLimit-Remaining": "0" } }
      );
    }
  }

  const body = await req.json().catch(() => null);
  if (!body?.packages || !Array.isArray(body.packages)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const packages: PackageDep[] = body.packages.slice(0, 200); // hard cap
  if (packages.length === 0) {
    return NextResponse.json({ error: "No packages provided" }, { status: 400 });
  }

  // Query OSV vulns for matching ecosystems
  const npmNames  = packages.filter(p => p.ecosystem === "npm").map(p => p.name);
  const pypiNames = packages.filter(p => p.ecosystem === "PyPI").map(p => p.name);

  const vulnRows: VulnMatch[] = [];

  // Fetch OSV vulns across all monitored ecosystems, making the API completely ecosystem agnostic
  const ecosystems = ["npm", "PyPI"];

  if (ecosystems.length > 0) {
    const { data } = await supabase
      .from("vulnerabilities")
      .select("osv_id, cve_id, summary, cvss_score, cvss_severity, combined_risk_score, affected_packages, ecosystem")
      .eq("source", "osv")
      .in("ecosystem", ecosystems)
      .limit(500000);

    const rows = data ?? [];

    for (const pkg of packages) {
      const matching = rows.filter((row) => {
        if (!row.affected_packages) return false;
        const pkgs: { name: string; ecosystem: string; versions?: string[] }[] =
          typeof row.affected_packages === "string"
            ? JSON.parse(row.affected_packages)
            : row.affected_packages;
            
        // Removed `p.ecosystem === pkg.ecosystem` check to support text payload fallbacks seamlessly
        return pkgs.some(
          (p) => p.name.toLowerCase() === pkg.name.toLowerCase()
        );
      });

      for (const row of matching) {
        const affectedPkgs: { name: string; versions?: string[] }[] =
          typeof row.affected_packages === "string"
            ? JSON.parse(row.affected_packages)
            : row.affected_packages ?? [];

        const affectedVersions = affectedPkgs
          .filter(p => p.name.toLowerCase() === pkg.name.toLowerCase())
          .flatMap(p => p.versions ?? [])
          .filter(Boolean);

        const currentBare = bareVersion(pkg.version);
        if (!isVersionVulnerable(currentBare, affectedVersions)) {
          continue; // Skips this row! Secure version matching!
        }

        vulnRows.push({
          package:             pkg.name,
          version:             pkg.version,
          osv_id:              row.osv_id,
          cve_id:              row.cve_id,
          summary:             row.summary,
          cvss_score:          row.cvss_score,
          cvss_severity:       row.cvss_severity,
          combined_risk_score: row.combined_risk_score,
          affected_versions:   affectedVersions,
        });
      }
    }
  }

  const critical = vulnRows.filter(v => v.cvss_severity === "CRITICAL").length;
  const high     = vulnRows.filter(v => v.cvss_severity === "HIGH").length;
  const medium   = vulnRows.filter(v => v.cvss_severity === "MEDIUM").length;
  const { grade, score } = computeGrade(vulnRows);

  const result: CheckResult = {
    grade,
    score,
    total_packages:   packages.length,
    vulnerable_count: vulnRows.length,
    critical_count:   critical,
    high_count:       high,
    vulns: vulnRows.sort((a, b) => (b.cvss_score ?? 0) - (a.cvss_score ?? 0)),
  };

  return NextResponse.json(result);
}
