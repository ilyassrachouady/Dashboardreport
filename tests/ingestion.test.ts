import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("atomic normalized ingestion preserves history, rejects identity conflicts and payment replays", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role service_role bypassrls;");
    await db.exec(
      await readFile(
        new URL("../supabase/001_reporting.sql", import.meta.url),
        "utf8",
      ),
    );
    const kpiMigration = await readFile(
      new URL("../supabase/002_webinar_kpis.sql", import.meta.url),
      "utf8",
    );
    await db.exec(kpiMigration);
    await db.exec(kpiMigration); // Safe for the operator to rerun.
    const ingest = (p: unknown) =>
      db.query<{
        ingest_contact_event: { contact_id: string; duplicate: boolean };
      }>("select revenue_intelligence.ingest_contact_event($1::jsonb)", [
        JSON.stringify(p),
      ]);
    const event = {
      provider: "whop",
      event_id: "e1",
      contact: {
        ghl_contact_id: "ghl-1",
        email: "Person@Example.com",
        first_name: "Sam",
      },
      touches: [
        {
          external_touch_id: "t1",
          touch_type: "first_touch",
          source: "IG",
          occurred_at: "2026-10-14T10:00:00Z",
        },
      ],
      webinars: [
        {
          external_id: "w1-occurrence",
          name: "Test webinar",
          webinar_date: "2026-10-14T19:00:00Z",
        },
      ],
      registrations: [
        {
          webinar_external_id: "w1-occurrence",
          registered_at: "2026-10-14T10:00:00Z",
          raw_utm_source: "IG",
        },
      ],
      appointments: [
        {
          external_id: "a1",
          scheduled_at: "2026-10-15T10:00:00Z",
          booked_at: "2026-10-14T20:00:00Z",
          status: "confirmed",
          webinar_external_id: "w1-occurrence",
        },
      ],
      calls: [
        {
          external_id: "c1",
          appointment_external_id: "a1",
          call_date: "2026-10-15T10:00:00Z",
          attendance: "attended",
          outcome: "sold",
        },
      ],
      sales: [
        {
          external_id: "s1",
          call_external_id: "c1",
          offer: "Coaching",
          payment_type: "three",
          contract_value: 420000,
          sold_at: "2026-10-15T11:00:00Z",
        },
      ],
      payments: [
        {
          external_payment_id: "p1",
          sale_external_id: "s1",
          amount: 140000,
          currency: "USD",
          status: "succeeded",
          paid_at: "2026-10-15T11:01:00Z",
        },
      ],
    };
    const first = await ingest(event);
    assert.equal(first.rows[0].ingest_contact_event.duplicate, false);
    assert.equal(
      (await ingest(event)).rows[0].ingest_contact_event.duplicate,
      true,
    );
    await assert.rejects(
      ingest({
        ...event,
        event_id: "e1",
        contact: { ...event.contact, first_name: "Changed" },
      }),
      /Replay payload conflict/,
    );
    await assert.rejects(
      ingest({
        ...event,
        event_id: "e2",
        contact: { ...event.contact, ghl_contact_id: "wrong" },
      }),
      /Canonical identity conflict/,
    );
    await assert.rejects(
      ingest({
        ...event,
        event_id: "e3",
        payments: [{ ...event.payments[0], amount: 420000 }],
      }),
      /Payment replay conflict/,
    );
    const sums = await db.query<{ contract_value: number; amount: number }>(
      "select s.contract_value,p.amount from revenue_intelligence.sales s join revenue_intelligence.payments p on p.sale_id=s.id",
    );
    assert.equal(Number(sums.rows[0].contract_value), 420000);
    assert.equal(Number(sums.rows[0].amount), 140000);
    const contacts = await db.query(
      "select * from revenue_intelligence.contacts",
    );
    assert.equal(contacts.rows.length, 1);
    const regs = await db.query<{ raw_utm_source: string }>(
      "select * from revenue_intelligence.webinar_registrations",
    );
    assert.equal(regs.rows[0].raw_utm_source, "IG");
  } finally {
    await db.close();
  }
});
