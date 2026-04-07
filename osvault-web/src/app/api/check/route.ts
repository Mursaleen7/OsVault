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

/** Compute A–F grade from vuln counts */
function computeGrade(total: number, critical: number, high: number, medium: number): { grade: CheckResult["grade"]; score: number } {
  if (total === 0) return { grade: "A", score: 100 };
  const penalty = critical * 25 + high * 10 + medium * 3;
  const score = Math.max(0, 100 - penalty);
  const grade =
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

  // Fetch all OSV vulns for these ecosystems in one query
  const ecosystems = [
    ...(npmNames.length  ? ["npm"]  : []),
    ...(pypiNames.length ? ["PyPI"] : []),
  ];

  if (ecosystems.length > 0) {
    const { data } = await supabase
      .from("vulnerabilities")
      .select("osv_id, cve_id, summary, cvss_score, cvss_severity, combined_risk_score, affected_packages, ecosystem")
      .eq("source", "osv")
      .in("ecosystem", ecosystems);

    const rows = data ?? [];

    for (const pkg of packages) {
      const matching = rows.filter((row) => {
        if (!row.affected_packages) return false;
        const pkgs: { name: string; ecosystem: string; versions?: string[] }[] =
          typeof row.affected_packages === "string"
            ? JSON.parse(row.affected_packages)
            : row.affected_packages;
        return pkgs.some(
          (p) => p.name.toLowerCase() === pkg.name.toLowerCase() &&
                 p.ecosystem?.toLowerCase() === pkg.ecosystem.toLowerCase()
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
  const { grade, score } = computeGrade(vulnRows.length, critical, high, medium);

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
