import { NextResponse } from "next/server";
import { refreshStaleSources } from "../../../../lib/auto-sync";

export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await refreshStaleSources({ freshForMs: 0 });
  return NextResponse.json({ ok: true, ...result });
}
