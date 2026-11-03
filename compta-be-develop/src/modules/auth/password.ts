import * as argon2 from 'argon2';

export const hashPassword = (plain: string) => argon2.hash(plain, { type: argon2.argon2id });

export const verifyPassword = (hash: string, plain: string) => argon2.verify(hash, plain);

// Verified against when the user does not exist, so response time does not reveal valid emails
let dummyHash: Promise<string> | undefined;
export async function burnPasswordCheck(plain: string) {
  dummyHash ??= hashPassword('dummy-password-for-timing');
  await verifyPassword(await dummyHash, plain);
}
