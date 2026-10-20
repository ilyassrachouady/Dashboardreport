import { eventSchema } from "./schema";
// Internal ingestion contract. Live native payment history is read by whop-history.ts.
export function adaptWhop(payload: unknown) {
  const event = eventSchema.parse(payload);
  if (event.provider !== "whop") throw new Error("Provider mismatch");
  return event;
}
