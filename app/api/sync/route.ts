import { NextResponse } from "next/server";
import { isDemo } from "../../../lib/db";
import { runSync } from "../../../lib/sync";
export const maxDuration = 300;
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  if (isDemo())
    return NextResponse.json({ message: "Demo mode: no external API called." });
  try {
    const { source } = await request.json();
    if (source !== "ghl" && source !== "whop" && source !== "trakyo" && source !== "webinars")
      return NextResponse.json(
        { error: "API credentials for this source are not configured." },
        { status: 409 },
      );
    const result = await runSync(source);
    return NextResponse.json(
      {
        ...result,
        message: `${result.processed} records imported; ${result.failed} require review.`,
      },
      { status: result.failed ? 422 : 200 },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 502 },
    );
  }
}
