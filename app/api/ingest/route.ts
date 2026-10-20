import { NextResponse } from "next/server";
import { authorizeIngestion } from "../../../lib/auth";
import { database, isDemo } from "../../../lib/db";
import { eventSchema } from "../../../lib/integrations/schema";
export async function POST(request: Request) {
  if (!authorizeIngestion(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (isDemo())
    return NextResponse.json(
      { error: "Ingestion is disabled in demo mode" },
      { status: 409 },
    );
  try {
    const text = await request.text();
    if (text.length > 250000)
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    const data = eventSchema.parse(JSON.parse(text));
    const result = await database().rpc("ingest_contact_event", {
      payload: data,
    });
    if (result.error)
      return NextResponse.json(
        {
          error:
            "Ingestion rejected. Check identity conflicts, replay payload and schema.",
        },
        { status: 422 },
      );
    return NextResponse.json(result.data);
  } catch {
    return NextResponse.json(
      { error: "Invalid ingestion event" },
      { status: 400 },
    );
  }
}
