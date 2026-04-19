// TEMPORARILY COMMENTED OUT - Add Clerk keys to enable auth
// import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import PricingClient from "./PricingClient";

export default async function PricingPage() {
  // TEMPORARILY DISABLED - Add Clerk keys to enable auth
  const orgId = null;
  // const { orgId } = await auth();

  let currentPlan = null;

  if (orgId) {
    // Determine user's active plan based on their organization assignment
    const { data } = await supabase
      .from("organizations")
      .select("plan")
      .eq("slug", orgId)
      .maybeSingle();

    if (data?.plan) {
      currentPlan = data.plan;
    } else {
      // Default to "free" tier if the org exists but somehow has no plan set
      currentPlan = "free";
    }
  }

  return <PricingClient currentPlan={currentPlan} />;
}
