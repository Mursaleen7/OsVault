/**
 * Stripe Webhook Handler
 *
 * Handles subscription lifecycle events from Stripe:
 *   - checkout.session.completed  → Create org subscription
 *   - customer.subscription.updated → Sync plan changes
 *   - customer.subscription.deleted → Downgrade to free
 *   - invoice.payment_failed → Flag payment issue
 */
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

// In production, use the Stripe SDK for signature verification.
// This is a simplified handler to demonstrate the architecture.

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!STRIPE_WEBHOOK_SECRET) {
    console.error("[stripe] STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  // In production: verify signature with stripe.webhooks.constructEvent()
  // For now, parse the event directly
  let event: {
    type: string;
    data: { object: Record<string, unknown> };
  };

  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  console.log(`[stripe] Event received: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const orgSlug = (session.metadata as Record<string, string>)?.org_slug;

        if (orgSlug && subscriptionId) {
          // Update org with Stripe IDs and upgrade plan
          await supabase
            .from("organizations")
            .update({
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              plan: "team",
              max_seats: 25,
              updated_at: new Date().toISOString(),
            })
            .eq("slug", orgSlug);

          // Log the upgrade
          await supabase.from("audit_logs").insert({
            actor_email: "system@osvault.dev",
            action: "subscription.created",
            resource_type: "subscription",
            resource_id: subscriptionId,
            metadata: { plan: "team", customer_id: customerId },
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const subscriptionId = subscription.id as string;
        const status = subscription.status as string;

        await supabase
          .from("subscriptions")
          .update({
            status,
            current_period_start: subscription.current_period_start
              ? new Date((subscription.current_period_start as number) * 1000).toISOString()
              : null,
            current_period_end: subscription.current_period_end
              ? new Date((subscription.current_period_end as number) * 1000).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscriptionId);

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;

        // Downgrade org to free tier
        await supabase
          .from("organizations")
          .update({
            plan: "free",
            max_seats: 1,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", customerId);

        // Log the downgrade
        await supabase.from("audit_logs").insert({
          actor_email: "system@osvault.dev",
          action: "subscription.canceled",
          resource_type: "subscription",
          resource_id: subscription.id as string,
          metadata: { customer_id: customerId },
        });

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = invoice.customer as string;

        await supabase.from("audit_logs").insert({
          actor_email: "system@osvault.dev",
          action: "payment.failed",
          resource_type: "invoice",
          resource_id: invoice.id as string,
          metadata: { customer_id: customerId },
        });

        break;
      }

      default:
        console.log(`[stripe] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[stripe] Webhook handler error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
