import { NextResponse } from "next/server";
import { z } from "zod";
import { database, isDemo } from "../../../lib/db";
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  if (isDemo())
    return NextResponse.json(
      { error: "Demo mappings are stored in this browser only" },
      { status: 409 },
    );
  try {
    const value = z
      .object({
        dimension: z.enum(["source", "medium", "campaign", "content"]),
        raw_value: z.string().min(1).max(200),
        normalized_value: z.string().trim().min(1).max(200),
      })
      .parse(await request.json());
    const r = await database()
      .from("source_mappings")
      .upsert(value, { onConflict: "dimension,raw_value" })
      .select()
      .single();
    if (r.error) throw r.error;
    return NextResponse.json(r.data);
  } catch {
    return NextResponse.json(
      { error: "Could not save normalization mapping" },
      { status: 400 },
    );
  }
}
