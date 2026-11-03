import { isValidIban, isValidSiret } from './identifiers';

describe('isValidSiret (Luhn)', () => {
  it.each(['73282932000074', '732 829 320 00074', '35600000000048', '35600000049837'])('accepts %s', (siret) => {
    expect(isValidSiret(siret)).toBe(true);
  });

  it.each(['73282932000075', '1234567890123', '7328293200007A', '', '35600000049838'])('rejects %s', (siret) => {
    expect(isValidSiret(siret)).toBe(false);
  });
});

describe('isValidIban (mod 97)', () => {
  it.each(['FR7630006000011234567890189', 'fr76 3000 6000 0112 3456 7890 189', 'DE89370400440532013000', 'GB82WEST12345698765432'])(
    'accepts %s',
    (iban) => expect(isValidIban(iban)).toBe(true),
  );

  it.each(['FR7630006000011234567890188', 'FR76', 'XX0000', '1234567890'])('rejects %s', (iban) => {
    expect(isValidIban(iban)).toBe(false);
  });
});
