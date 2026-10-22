import { z } from "zod";
const cohortContact = z.object({
  id: z.string(),
  tags: z.array(z.string()).default([]),
  customFields: z
    .array(z.object({ id: z.string(), value: z.unknown() }))
    .default([]),
});
export function webinarTagMap(sessions: Array<{external_id:string;ghl_cohort_tag?:string|null}> = []): Record<string, string> {
  const value = process.env.GHL_WEBINAR_TAG_MAP_JSON;
  const map=z.record(z.string(), z.string().min(1)).parse(JSON.parse(value||"{}"));
  for(const w of sessions)if(w.ghl_cohort_tag)map[w.external_id]=w.ghl_cohort_tag;
  return map;
}
export function countWebinarCohort(
  contacts: unknown[],
  tag: string,
  fields: Record<string, string>,
) {
  if (!fields.application_submitted)
    throw new Error("Application field mapping is required");
  const unique = new Map<string, z.infer<typeof cohortContact>>();
  for (const raw of contacts) {
    const c = cohortContact.parse(raw);
    if (c.tags.includes(tag)) unique.set(c.id, c);
  }
  let applicants = 0,
    booked = 0,
    both = 0;
  for (const c of unique.values()) {
    const value = (key: string) =>
      c.customFields.find((f) => f.id === fields[key])?.value;
    const applied =
      String(value("application_submitted") ?? "")
        .trim()
        .toLowerCase() === "yes";
    const date = value("appointment_booked_date");
    const hasBooking =
      typeof date === "string" &&
      date.trim() !== "" &&
      Number.isFinite(Date.parse(date));
    if (applied) applicants++;
    if (hasBooking) booked++;
    if (applied && hasBooking) both++;
  }
  return {
    tagged_contacts: unique.size,
    application_count: applicants,
    contacts_with_booking_date: booked,
    applicants_with_booking_date: both,
  };
}
