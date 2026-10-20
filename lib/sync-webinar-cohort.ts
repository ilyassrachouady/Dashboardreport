import "server-only";
import { database } from "./db";
import { webinarTagMap, countWebinarCohort } from "./integrations/ghl-webinar";
export async function syncWebinarCohorts(
  contacts: unknown[],
  fields: Record<string, string>,
  onlyId?: string,
) {
  const db = database(),
    map = webinarTagMap();
  const results: Array<
    ReturnType<typeof countWebinarCohort> & { webinar_id: string }
  > = [];
  if (!Object.keys(map).length) return results;
  const selected = await db.from("webinars").select("id,external_id");
  if (selected.error) throw new Error("Unable to read webinar mapping");
  for (const w of selected.data) {
    const tag = map[w.external_id];
    if (!tag || (onlyId && w.id !== onlyId)) continue;
    const counts = countWebinarCohort(contacts, tag, fields);
    // A missing tag is a configuration error, not evidence that the cohort has zero conversions.
    if (!counts.tagged_contacts)
      throw new Error("No contacts match the configured webinar tag");
    const stamp = new Date().toISOString();
    const saved = await db
      .from("webinars")
      .update({
        application_count: counts.application_count,
        kpi_updated_at: stamp,
      })
      .eq("id", w.id);
    if (saved.error) throw new Error("Could not save CRM webinar counts");
    const audit = await db
      .from("sync_runs")
      .insert({
        source: `ghl_webinar:${w.id}`,
        status: "succeeded",
        started_at: stamp,
        completed_at: stamp,
        records_processed: counts.tagged_contacts,
        records_failed: 0,
      });
    if (audit.error) throw new Error("Could not save cohort sync status");
    results.push({ webinar_id: w.id, ...counts });
  }
  if (onlyId && !results.length)
    throw new Error("No CRM cohort tag mapped to this session");
  return results;
}
