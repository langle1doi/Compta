import { Matches } from 'class-validator';

/** PostgreSQL text cannot hold U+0000: without this the query fails with a 500 (E-API-04). */
export const NoNullByte = () => Matches(/^[^\0]*$/, { message: '$property must not contain a null byte' });
