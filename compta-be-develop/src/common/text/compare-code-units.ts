/** Same order as sort() without a compare function: by UTF-16 code unit, independent of the locale of the server. */
export const compareCodeUnits = (a: string, b: string) => {
  if (a < b) return -1;
  return a > b ? 1 : 0;
};
