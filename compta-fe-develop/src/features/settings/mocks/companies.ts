import type { Company } from "../types";

export const mockCompanies: Company[] = [
  {
    id: "co-dfm-europe",
    name: "DFM-Europe",
    legalName: "DFM-Europe SAS",
    currency: "EUR",
    status: "ACTIVE",
    siret: "812 345 678 00019",
    vatNumber: "FR42812345678",
    naf: "6201Z",
    iban: "FR76 3000 6000 0112 3456 7890 189",
    bic: "AGRIFRPP",
    address: "12 rue de la Paix, 75002 Paris, France",
    subtitle: "Tenant DFM · EUR",
  },
  {
    id: "co-dfm-romania",
    name: "DFM Romania",
    legalName: "DFM Romania SRL",
    currency: "RON",
    status: "ACTIVE",
    siret: "RO-J40/1234/2019",
    vatNumber: "RO38765432",
    naf: "6201",
    iban: "RO49 AAAA 1B31 0075 9384 0000",
    bic: "AAAAROBU",
    address: "Strada Exemplu 10, București, Romania",
    subtitle: "Tenant DFM · RON",
  },
  {
    id: "co-dfm-belgium",
    name: "DFM Belgium",
    legalName: "DFM Belgium BV",
    currency: "EUR",
    status: "ACTIVE",
    siret: "BE 0123.456.789",
    vatNumber: "BE0123456789",
    naf: "62010",
    iban: "BE68 5390 0754 7034",
    bic: "GKCCBEBB",
    address: "Rue du Commerce 20, 1000 Bruxelles, Belgium",
    subtitle: "Tenant DFM · EUR",
  },
  {
    id: "co-dfm-usa",
    name: "DFM USA",
    legalName: "DFM USA Inc.",
    currency: "USD",
    status: "ACTIVE",
    vatNumber: "US-98-7654321",
    address: "100 Market Street, San Francisco, CA 94105, USA",
    subtitle: "Tenant DFM · USD",
  },
  {
    id: "co-dfm-demo",
    name: "DFM Demo",
    legalName: "DFM Demo SAS",
    currency: "EUR",
    status: "ARCHIVED",
    siret: "900 111 222 00011",
    vatNumber: "FR00900111222",
    address: "Sandbox entity — not for production documents",
    subtitle: "Sandbox · archived",
  },
];

export const DEFAULT_COMPANY_ID = "co-dfm-europe";

export function getActiveCompanies(companies: Company[] = mockCompanies): Company[] {
  return companies.filter((company) => company.status === "ACTIVE");
}

export function emptyCompanyDraft(): import("../types").CompanyDraft {
  return {
    name: "",
    legalName: "",
    currency: "EUR",
    siret: "",
    vatNumber: "",
    naf: "",
    iban: "",
    bic: "",
    address: "",
    logoUrl: "",
  };
}

export function companyToDraft(company: Company): import("../types").CompanyDraft {
  return {
    name: company.name,
    legalName: company.legalName,
    currency: company.currency,
    siret: company.siret ?? "",
    vatNumber: company.vatNumber ?? "",
    naf: company.naf ?? "",
    iban: company.iban ?? "",
    bic: company.bic ?? "",
    address: company.address ?? "",
    logoUrl: company.logoUrl ?? "",
  };
}
