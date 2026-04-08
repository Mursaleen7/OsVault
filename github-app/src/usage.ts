/**
 * Track monthly check usage per installation.
 * Free tier: 10 checks/month for private repos.
 * Public repos: unlimited.
 */
import { supabase } from "./supabase";

const FREE_LIMIT = 10;

export async function getUsageThisMonth(installationId: number): Promise<number> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("github_usage")
    .select("*", { count: "exact", head: true })
    .eq("installation_id", installationId)
    .gte("created_at", start.toISOString());

  return count ?? 0;
}

export async function recordUsage(installationId: number, repo: string, prNumber: number) {
  await supabase.from("github_usage").insert({
    installation_id: installationId,
    repo,
    pr_number: prNumber,
  });
}

export async function isOverLimit(installationId: number): Promise<boolean> {
  const usage = await getUsageThisMonth(installationId);
  return usage >= FREE_LIMIT;
}

export { FREE_LIMIT };
