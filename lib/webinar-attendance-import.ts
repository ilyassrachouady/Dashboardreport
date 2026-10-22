import { z } from "zod";
export const attendanceImportSchema = z.object({
  webinar_id: z.uuid(),
  preview: z.boolean().default(true),
  rows: z.array(z.object({
    email: z.email().transform(v => v.trim().toLowerCase()),
    attended_live: z.boolean().nullable(),
    attended_replay: z.boolean().nullable(),
  }).strict().refine(r => r.attended_live !== null || r.attended_replay !== null, "Supply live or replay attendance evidence.")).min(1).max(2000),
}).strict().superRefine((v, ctx) => {
  const emails = new Set<string>();
  for (const row of v.rows) {
    if (emails.has(row.email)) ctx.addIssue({ code: "custom", message: `Duplicate email in import: ${row.email}` });
    emails.add(row.email);
  }
});

// Small quoted CSV reader. Commas/newlines inside quoted cells are preserved.
export function parseAttendanceCsv(text: string) {
  if (text.length > 1000000) throw new Error("Attendance file is too large.");
  const records: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (c === "," || c === "\n")) {
      row.push(cell.trim()); cell = "";
      if (c === "\n") { if (row.some(Boolean)) records.push(row); row = []; }
    } else if (c !== "\r" || quoted) cell += c;
  }
  if (quoted) throw new Error("Unclosed quote in CSV.");
  row.push(cell.trim()); if (row.some(Boolean)) records.push(row);
  const headers = records.shift()?.map(s => s.toLowerCase()) || [];
  if (headers.length !== 3 || new Set(headers).size !== 3 || !["email","attended_live","attended_replay"].every(h => headers.includes(h)))
    throw new Error("CSV columns must be email, attended_live, attended_replay. Use true, false or blank for attendance.");
  const flag = (s: string) => {
    if (!s) return null;
    if (s.toLowerCase() === "true") return true;
    if (s.toLowerCase() === "false") return false;
    throw new Error("Attendance must be true, false or blank. Blank means unknown.");
  };
  return records.map(r => {
    if (r.length !== headers.length) throw new Error("CSV row has the wrong number of columns.");
    const at = (name: string) => r[headers.indexOf(name)];
    return { email: at("email").toLowerCase(), attended_live: flag(at("attended_live")), attended_replay: flag(at("attended_replay")) };
  });
}
