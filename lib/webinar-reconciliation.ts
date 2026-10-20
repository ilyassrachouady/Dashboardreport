// User-provided analytics export, reviewed 2026-10-20. Historical reference only;
// never manufacture contacts or overwrite the live API count to match an aggregate CSV.
export const webinarExportReferences: Record<
  string,
  { registrants: number; label: string }
> = {
  "webinarjam:2:2:2": {
    registrants: 291,
    label: "Uploaded WebinarJam analytics CSV",
  },
};
export function registrantReview(externalId: string, importedUnique: number) {
  const reference = webinarExportReferences[externalId];
  if (!reference || reference.registrants === importedUnique) return null;
  return {
    ...reference,
    importedUnique,
    difference: reference.registrants - importedUnique,
  };
}
