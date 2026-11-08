import { NextResponse } from "next/server";
import { loadUgcReport } from "../../../../lib/load-ugc-report";
import { sameOrigin } from "../../../../lib/same-origin";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
async function report(syncNotion = false) {
  try {
    return NextResponse.json(await loadUgcReport(syncNotion), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "UGC reporting unavailable." },
      { status: 502, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
export async function GET() {
  return report();
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  return report(true);
}
