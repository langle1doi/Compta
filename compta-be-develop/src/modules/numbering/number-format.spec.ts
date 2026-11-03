import { DocumentType } from '../../generated/tenant/enums';
import { DEFAULT_FORMATS, isValidFormat, renderNumber } from './number-format';

describe('renderNumber', () => {
  it('renders the PRD default formats', () => {
    expect(renderNumber(DEFAULT_FORMATS[DocumentType.INVOICE], 2026, 7)).toBe('FAC20260007');
    expect(renderNumber(DEFAULT_FORMATS[DocumentType.QUOTE], 2026, 123)).toBe('DEV20260123');
    expect(renderNumber(DEFAULT_FORMATS[DocumentType.CREDIT_NOTE], 2027, 1)).toBe('AV20270001');
    expect(renderNumber(DEFAULT_FORMATS[DocumentType.CUSTOMER], 0, 42)).toBe('C00042');
  });

  it('never truncates a counter longer than its padding', () => {
    expect(renderNumber('FAC{YYYY}{NNNN}', 2026, 12345)).toBe('FAC202612345');
  });
});

describe('isValidFormat', () => {
  it('requires a counter token and no stray braces', () => {
    expect(isValidFormat('FAC{YYYY}{NNNN}')).toBe(true);
    expect(isValidFormat('FAC{YYYY}')).toBe(false);
    expect(isValidFormat('FAC{XX}{NNN}')).toBe(false);
  });
});
