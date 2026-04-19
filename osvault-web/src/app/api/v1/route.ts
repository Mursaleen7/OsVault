/**
 * OsVault Enterprise REST API
 *
 * Authenticated endpoints for security operations centers (SOC)
 * to programmatically pull repo health scores and CVE status.
 *
 * Authentication: Bearer token (API key from org settings)
 *
 * Endpoints:
 *   GET  /api/v1/scan-results   — List recent scan results for the org
 *   GET  /api/v1/vulnerabilities — Query vulnerabilities affecting org repos
 *   GET  /api/v1/health-score   — Get aggregate security health score
 */
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Simple API key validation (in production, use proper auth middleware)
async function validateApiKey(request: NextRequest): Promise<{ orgId: number } | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const apiKey = authHeader.slice(7);
  if (!apiKey) return null;

  // In production: look up API key in an api_keys table
  // For now, validate against org-specific keys
  const { data } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", apiKey) // Simplified — real impl would hash keys
    .single();

  return data ? { orgId: data.id } : null;
}

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid Bearer token." },
      { status: 401 }
    );
  }

  const { searchParams } = request.nextUrl;
  const endpoint = searchParams.get("endpoint") ?? "health-score";

  switch (endpoint) {
    case "scan-results": {
      const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
      const { data, error } = await supabase
        .from("scan_results")
        .select("*")
        .eq("organization_id", auth.orgId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data, count: data?.length ?? 0 });
    }

    case "vulnerabilities": {
      const severity = searchParams.get("severity");
      const ecosystem = searchParams.get("ecosystem");
      let query = supabase
        .from("vulnerabilities")
        .select("cve_id, summary, cvss_score, cvss_severity, epss_score, in_kev, combined_risk_score, published_at")
        .order("combined_risk_score", { ascending: false })
        .limit(100);

      if (severity) query = query.eq("cvss_severity", severity.toUpperCase());
      if (ecosystem) query = query.eq("ecosystem", ecosystem);

      const { data, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data, count: data?.length ?? 0 });
    }

    case "health-score":
    default: {
      // Aggregate health score across all scans
      const { data: recentScans } = await supabase
        .from("scan_results")
        .select("total_vulns, reachable_vulns, bypassed_vulns, critical_count, high_count, conclusion")
        .eq("organization_id", auth.orgId)
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(500);

      const scans = recentScans ?? [];
      const totalScans = scans.length;
      const passedScans = scans.filter(s => s.conclusion === "success").length;
      const totalReachable = scans.reduce((acc, s) => acc + (s.reachable_vulns ?? 0), 0);
      const totalBypassed = scans.reduce((acc, s) => acc + (s.bypassed_vulns ?? 0), 0);
      const totalCritical = scans.reduce((acc, s) => acc + (s.critical_count ?? 0), 0);

      // Health score: 100 = perfect, 0 = critical
      let healthScore = 100;
      if (totalScans > 0) {
        const passRate = passedScans / totalScans;
        const criticalPenalty = Math.min(totalCritical * 5, 40);
        const reachablePenalty = Math.min(totalReachable * 2, 30);
        healthScore = Math.max(0, Math.round(passRate * 100 - criticalPenalty - reachablePenalty));
      }

      return NextResponse.json({
        healthScore,
        grade: healthScore >= 90 ? "A" : healthScore >= 75 ? "B" : healthScore >= 60 ? "C" : healthScore >= 40 ? "D" : "F",
        period: "last_30_days",
        metrics: {
          totalScans,
          passedScans,
          failedScans: totalScans - passedScans,
          totalReachableVulns: totalReachable,
          totalBypassedVulns: totalBypassed,
          totalCriticalVulns: totalCritical,
          noiseReductionRate: totalBypassed + totalReachable > 0
            ? Math.round((totalBypassed / (totalBypassed + totalReachable)) * 100)
            : 100,
        },
      });
    }
  }
}
