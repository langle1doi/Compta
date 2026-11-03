/** Luhn checksum on a string of digits. */
function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

// La Poste establishments (SIREN 356000000) use "sum of digits divisible by 5" instead of Luhn
const LA_POSTE_SIREN = '356000000';

/** French SIRET: 14 digits, Luhn-valid (F03 AC-03). Spaces are ignored. */
export function isValidSiret(value: string): boolean {
  const siret = value.replace(/\s/g, '');
  if (!/^\d{14}$/.test(siret)) return false;
  if (siret.startsWith(LA_POSTE_SIREN) && siret !== '35600000000048') {
    return [...siret].reduce((s, d) => s + Number(d), 0) % 5 === 0;
  }
  return luhn(siret);
}

/** IBAN: ISO 13616 structure + mod-97 checksum (F03 AC-03). Spaces are ignored, case-insensitive. */
export function isValidIban(value: string): boolean {
  const iban = value.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const n = char >= 'A' ? (char.charCodeAt(0) - 55).toString() : char;
    for (const digit of n) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

export const normalizeIdentifier = (value: string) => value.replace(/\s/g, '').toUpperCase();
