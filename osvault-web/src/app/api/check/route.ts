import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import semver from "semver";

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
// Helpers — Version Matching (powered by node-semver)
// ---------------------------------------------------------------------------

/**
 * Coerce a dirty version string into a clean semver.
 * Handles: "^4.17.21" → "4.17.21", "v1.2.3" → "1.2.3",
 *          "1.2" → "1.2.0", "2.0.0-rc.1" → "2.0.0-rc.1"
 */
function cleanVersion(v: string): string | null {
  let normalized = v.trim().toLowerCase();
  
  // Convert PyPI pre-releases to strict semver: 1.0a1 -> 1.0.0-alpha.1, 1.0.dev0 -> 1.0.0-dev.0
  normalized = normalized.replace(/([0-9])\.?(a|alpha|b|beta|rc|c|pre|dev)([0-9]*)/, (match, prefix, tag, suffix) => {
    const map: Record<string, string> = { 
      a: 'alpha', alpha: 'alpha', 
      b: 'beta', beta: 'beta', 
      rc: 'rc', c: 'rc', pre: 'rc', 
      dev: 'dev' 
    };
    return `${prefix}-${map[tag]}.${suffix || '0'}`;
  });

  // Handle 4-part versions: 1.2.3.4 -> 1.2.3-rev.4
  normalized = normalized.replace(/^([0-9]+\.[0-9]+\.[0-9]+)\.([0-9]+)(.*)$/, '$1-rev.$2$3');

  // First try parsing as-is (handles pre-release tags correctly)
  const parsed = semver.parse(normalized);
  if (parsed) return parsed.version;

  // Fall back to coercion for dirty strings like "^1.2.3" or "~2.0"
  const coerced = semver.coerce(normalized);
  return coerced ? coerced.version : null;
}

/**
 * Check if a user's installed version falls within any of the
 * [introduced, fixed) vulnerability boundaries from OSV data.
 *
 * Boundaries come as flat arrays: [introduced1, fixed1, introduced2, fixed2, ...]
 * A missing "fixed" (odd-length tail) means "all versions >= introduced are affected."
 */
function isVersionVulnerable(currentVer: string, bounds: string[]): boolean {
  if (!bounds || bounds.length === 0) return true; // No bounds = generic advisory

  const current = cleanVersion(currentVer);
  if (!current) return true; // Can't parse → assume vulnerable (safety-first)

  for (let i = 0; i < bounds.length; i += 2) {
    const introduced = cleanVersion(bounds[i]);
    if (!introduced) continue;

    const fixed = i + 1 < bounds.length ? cleanVersion(bounds[i + 1]) : null;

    // current >= introduced
    if (semver.gte(current, introduced)) {
      // No fix version → everything above introduced is vulnerable
      if (!fixed) return true;
      // current < fixed → still in the vulnerable window
      if (semver.lt(current, fixed)) return true;
    }
  }

  return false;
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

        const currentClean = cleanVersion(pkg.version);
        if (!currentClean || !isVersionVulnerable(currentClean, affectedVersions)) {
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
