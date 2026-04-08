import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Use service role key server-side so we can write to leads table
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { email, result } = body ?? {};

  if (!email || !result) {
    return NextResponse.json({ error: "Missing email or result" }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  // Save lead — ignore duplicate emails
  await sb.from("leads").upsert({ email, source: "checker_pdf" }, { onConflict: "email" });

  // Return the full result — PDF is generated client-side
  return NextResponse.json({ ok: true, result });
}
