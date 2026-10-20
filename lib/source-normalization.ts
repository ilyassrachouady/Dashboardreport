/** Conservative aliases verified against Creator Society's CRM. Never rewrite raw tracking data. */
const SOURCE_ALIASES: Record<string, string> = {
  ig: "Instagram",
  instagram: "Instagram",
  youtube: "YouTube",
  skool: "Skool",
  email: "Email",
  whatsapp: "WhatsApp",
  discord: "Discord",
  webinar: "Webinar",
  referral: "Referral",
  referrer: "Referral",
  direct: "Direct",
  "direct traffic": "Direct",
};
export function sourceMapping(raw: string) {
  const normalized = SOURCE_ALIASES[raw.trim().toLowerCase()];
  return normalized && normalized !== raw
    ? { dimension: "source" as const, raw_value: raw, normalized_value: normalized }
    : null;
}
export function sourceMappings(values: string[]) {
  return [...new Set(values)].flatMap(value => {
    const mapping = sourceMapping(value);
    return mapping ? [mapping] : [];
  });
}
