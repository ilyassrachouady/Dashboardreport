// Historical CSV reference retired: the confirmed TCS001 total is the live API count.
export const webinarExportReferences: Record<
  string,
  { registrants: number; label: string }
> = {};
export function registrantReview(externalId: string, importedUnique: number) {
  const reference = webinarExportReferences[externalId];
  if (!reference || reference.registrants === importedUnique) return null;
  return {
    ...reference,
    importedUnique,
    difference: reference.registrants - importedUnique,
  };
}
