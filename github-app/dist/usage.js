"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FREE_LIMIT = void 0;
exports.getUsageThisMonth = getUsageThisMonth;
exports.recordUsage = recordUsage;
exports.isOverLimit = isOverLimit;
/**
 * Track monthly check usage per installation.
 * Free tier: 10 checks/month for private repos.
 * Public repos: unlimited.
 */
const supabase_1 = require("./supabase");
const FREE_LIMIT = 10;
exports.FREE_LIMIT = FREE_LIMIT;
async function getUsageThisMonth(installationId) {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const { count } = await supabase_1.supabase
        .from("github_usage")
        .select("*", { count: "exact", head: true })
        .eq("installation_id", installationId)
        .gte("created_at", start.toISOString());
    return count ?? 0;
}
async function recordUsage(installationId, repo, prNumber) {
    await supabase_1.supabase.from("github_usage").insert({
        installation_id: installationId,
        repo,
        pr_number: prNumber,
    });
}
async function isOverLimit(installationId) {
    const usage = await getUsageThisMonth(installationId);
    return usage >= FREE_LIMIT;
}
