import './env';
import { dropE2eDatabases } from '../support/db';

export default async function globalTeardown() {
  if (process.env.E2E_KEEP_DATABASES !== 'true') await dropE2eDatabases();
}
