export type CustomerCountryOption = {
  code: string;
  name: string;
  dial: string;
};

/** Common COMPTE markets — flag + dial for phone / address selectors. */
export const CUSTOMER_COUNTRIES: CustomerCountryOption[] = [
  { code: "FR", name: "France", dial: "+33" },
  { code: "BE", name: "Belgium", dial: "+32" },
  { code: "CH", name: "Switzerland", dial: "+41" },
  { code: "LU", name: "Luxembourg", dial: "+352" },
  { code: "DE", name: "Germany", dial: "+49" },
  { code: "ES", name: "Spain", dial: "+34" },
  { code: "IT", name: "Italy", dial: "+39" },
  { code: "PT", name: "Portugal", dial: "+351" },
  { code: "NL", name: "Netherlands", dial: "+31" },
  { code: "GB", name: "United Kingdom", dial: "+44" },
  { code: "IE", name: "Ireland", dial: "+353" },
  { code: "SE", name: "Sweden", dial: "+46" },
  { code: "NO", name: "Norway", dial: "+47" },
  { code: "DK", name: "Denmark", dial: "+45" },
  { code: "FI", name: "Finland", dial: "+358" },
  { code: "AT", name: "Austria", dial: "+43" },
  { code: "PL", name: "Poland", dial: "+48" },
  { code: "US", name: "United States", dial: "+1" },
  { code: "CA", name: "Canada", dial: "+1" },
  { code: "MA", name: "Morocco", dial: "+212" },
  { code: "TN", name: "Tunisia", dial: "+216" },
  { code: "DZ", name: "Algeria", dial: "+213" },
  { code: "SN", name: "Senegal", dial: "+221" },
  { code: "CI", name: "Côte d’Ivoire", dial: "+225" },
  { code: "VN", name: "Vietnam", dial: "+84" },
];

const BY_CODE = new Map(CUSTOMER_COUNTRIES.map((item) => [item.code, item]));

export function getCountryByCode(code?: string | null) {
  if (!code) return undefined;
  return BY_CODE.get(code.trim().toUpperCase());
}

export function getCountryByName(name?: string | null) {
  if (!name) return undefined;
  const normalized = name.trim().toLowerCase();
  return CUSTOMER_COUNTRIES.find((item) => item.name.toLowerCase() === normalized);
}

export function countryLabel(code?: string | null, fallback = "—") {
  return getCountryByCode(code)?.name ?? fallback;
}

export function parsePhoneValue(value: string): { code: string; national: string } {
  const trimmed = value.trim();
  if (!trimmed) return { code: "FR", national: "" };

  const ranked = [...CUSTOMER_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const country of ranked) {
    if (trimmed === country.dial || trimmed.startsWith(`${country.dial} `) || trimmed.startsWith(country.dial)) {
      const rest = trimmed.slice(country.dial.length).trim();
      return { code: country.code, national: rest };
    }
  }

  return { code: "FR", national: trimmed.replace(/^\+\d+\s*/, "") };
}

/** Keep only phone-safe national digits / spacing (no letters). */
export function sanitizeNationalPhone(national: string) {
  return national.replace(/[^\d\s().-]/g, "").replace(/[().-]+/g, " ").replace(/\s+/g, " ");
}

export function composePhone(code: string, national: string) {
  const country = getCountryByCode(code) ?? CUSTOMER_COUNTRIES[0];
  const rest = sanitizeNationalPhone(national).trim();
  return rest ? `${country.dial} ${rest}` : "";
}
