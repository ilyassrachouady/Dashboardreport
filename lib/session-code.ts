export const clientSeries = ["TCS", "QUE"] as const;
export type ClientSeries = (typeof clientSeries)[number];
export const clientSeriesLabels: Record<ClientSeries, string> = {
  TCS: "The Creator Society",
  QUE: "UGC Queen",
};
const codePattern = /^(TCS|QUE)(\d{3})$/;
export function parseSessionCode(code: string) {
  const match = codePattern.exec(code);
  if (!match) return null;
  return { series: match[1] as ClientSeries, number: Number(match[2]) };
}
export function formatSessionCode(series: ClientSeries, number: number) {
  if (!clientSeries.includes(series) || !Number.isInteger(number) || number < 1 || number > 999)
    throw new Error("Session code is out of range.");
  return `${series}${String(number).padStart(3, "0")}`;
}
export function knownSessionCodes(
  rows: Array<{ session_code?: string | null; released_codes?: string | null }>,
) {
  return rows.flatMap((row) =>
    [row.session_code, ...(row.released_codes || "").split(",")]
      .map((code) => code?.trim())
      .filter((code): code is string => Boolean(code && parseSessionCode(code))),
  );
}
export function nextSessionCode(codes: string[], series: ClientSeries) {
  const highest = codes.reduce(
    (max, code) => Math.max(max, parseSessionCode(code)?.series === series ? parseSessionCode(code)!.number : 0),
    0,
  );
  return formatSessionCode(series, highest + 1);
}
export function assignMissingSessionCodes<
  T extends {
    id: string;
    webinar_date: string;
    session_code?: string | null;
    client_series?: string | null;
    released_codes?: string | null;
  },
>(rows: T[]): Array<T & { client_series: ClientSeries; session_code: string }> {
  const pending = rows
    .filter((row) => !row.session_code)
    .sort((a, b) => a.webinar_date.localeCompare(b.webinar_date) || a.id.localeCompare(b.id));
  const codes = knownSessionCodes(rows);
  return pending.map((row) => {
    const series: ClientSeries = row.client_series === "QUE" ? "QUE" : "TCS";
    const session_code = nextSessionCode(codes, series);
    codes.push(session_code);
    return { ...row, client_series: series, session_code };
  });
}
export function changeClientSeries<
  T extends {
    id: string;
    session_code?: string | null;
    client_series?: string | null;
    released_codes?: string | null;
  },
>(rows: T[], id: string, series: ClientSeries) {
  const current = rows.find((row) => row.id === id);
  if (!current) throw new Error("Session not found.");
  if (current.client_series === series && current.session_code?.startsWith(series)) return current;
  const released = [current.released_codes, current.session_code].filter(Boolean).join(",");
  const session_code = nextSessionCode(
    knownSessionCodes(rows.map((row) => (row.id === id ? { ...row, session_code: null, released_codes: released } : row))),
    series,
  );
  return { ...current, client_series: series, session_code, released_codes: released };
}
