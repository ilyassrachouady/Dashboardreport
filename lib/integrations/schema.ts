import { z } from "zod";
const timestamp = z.iso.datetime({ offset: true });
export const eventSchema = z.object({
  provider: z.enum(["ghl", "trakyo", "webinars", "whop"]),
  event_id: z.string().min(1).max(250),
  contact: z
    .object({
      ghl_contact_id: z.string().min(1).optional(),
      email: z
        .email()
        .transform((s) => s.trim().toLowerCase())
        .optional(),
      phone: z
        .string()
        .regex(/^\+[1-9]\d{7,14}$/)
        .optional(),
      trakyo_id: z.string().min(1).optional(),
      first_name: z.string().default(""),
      last_name: z.string().default(""),
      created_at: timestamp.optional(),
    })
    .refine(
      (c) => !!(c.ghl_contact_id || c.email || c.phone || c.trakyo_id),
      "A stable contact identifier is required",
    ),
  touches: z
    .array(
      z.object({
        external_touch_id: z.string().min(1),
        touch_type: z.enum(["first_touch", "last_touch", "conversion_touch"]),
        source: z.string().default(""),
        medium: z.string().default(""),
        campaign: z.string().default(""),
        content: z.string().default(""),
        occurred_at: timestamp,
      }),
    )
    .default([]),
  webinars: z
    .array(
      z.object({
        external_id: z.string().min(1),
        name: z.string().min(1),
        webinar_date: timestamp,
        peak_attendees: z.number().int().nonnegative().nullable().optional(),
        pitch_attendees: z.number().int().nonnegative().nullable().optional(),
      }),
    )
    .default([]),
  registrations: z
    .array(
      z.object({
        webinar_external_id: z.string().min(1),
        registered_at: timestamp,
        raw_utm_source: z.string().default(""),
        raw_utm_medium: z.string().default(""),
        raw_utm_campaign: z.string().default(""),
        raw_utm_content: z.string().default(""),
      }),
    )
    .default([]),
  appointments: z
    .array(
      z.object({
        external_id: z.string().min(1),
        scheduled_at: timestamp,
        booked_at: timestamp,
        status: z.string().min(1),
        closer: z.string().default(""),
        webinar_external_id: z.string().optional(),
      }),
    )
    .default([]),
  calls: z
    .array(
      z.object({
        external_id: z.string().min(1),
        appointment_external_id: z.string().optional(),
        call_date: timestamp,
        closer: z.string().default(""),
        attendance: z.enum(["attended", "no_show", "cancelled", "rescheduled"]),
        outcome: z
          .enum(["sold", "deposit", "follow_up", "no_sale", "unqualified"])
          .nullable(),
        recording_url: z
          .url()
          .refine((v) => v.startsWith("https://"))
          .optional(),
      }),
    )
    .default([]),
  sales: z
    .array(
      z.object({
        external_id: z.string().min(1),
        call_external_id: z.string().optional(),
        offer: z.string().min(1),
        payment_type: z.string().min(1),
        contract_value: z
          .number()
          .int()
          .nonnegative()
          .max(Number.MAX_SAFE_INTEGER),
        sold_at: timestamp,
      }),
    )
    .default([]),
  payments: z
    .array(
      z.object({
        external_payment_id: z.string().min(1),
        sale_external_id: z.string().optional(),
        amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
        currency: z.literal("USD"),
        status: z.enum(["succeeded", "pending", "failed", "refunded"]),
        paid_at: timestamp,
      }),
    )
    .default([]),
});
export type IngestionEvent = z.infer<typeof eventSchema>;
