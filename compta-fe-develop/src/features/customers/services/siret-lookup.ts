import type { SiretLookupResult } from "../types";

const MOCK_DIRECTORY: Record<string, SiretLookupResult> = {
  "81234567800019": {
    legalName: "TechVision SARL",
    vatNumber: "FR12345678901",
    address: {
      line1: "14 Avenue de la République",
      city: "Paris",
      postalCode: "75011",
      country: "France",
      countryCode: "FR",
    },
  },
  "89012345600012": {
    legalName: "Nova Atelier SAS",
    vatNumber: "FR77889900112",
    address: {
      line1: "3 Rue Sainte-Catherine",
      city: "Bordeaux",
      postalCode: "33000",
      country: "France",
      countryCode: "FR",
    },
  },
};

export function isOptionalSiretValid(raw: string) {
  const compact = raw.replace(/\s/g, "");
  if (!compact) return true;
  return /^\d{14}$/.test(compact);
}

/** Mock SIRET lookup — replace with backend integration later. */
export async function lookupSiret(raw: string): Promise<SiretLookupResult | null> {
  const siret = raw.replace(/\s/g, "");
  await new Promise((resolve) => setTimeout(resolve, 450));
  if (!/^\d{14}$/.test(siret)) {
    throw new Error("INVALID_SIRET");
  }
  return MOCK_DIRECTORY[siret] ?? null;
}
