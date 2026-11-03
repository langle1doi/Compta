import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import 'reflect-metadata';
import './env';
import { seedControl } from '../../src/cli/seed-control';
import { dropE2eDatabases, e2eControlDbName, withAdmin } from '../support/db';

const ROOT = join(__dirname, '..', '..');

/**
 * Brand-new platform: fresh control DB, migrated, then seeded exactly like a first deployment
 * (plans, default Super Admin, default tenant "dfm" with its default accounts).
 */
export default async function globalSetup() {
  await dropE2eDatabases();
  await withAdmin((c) => c.query(`CREATE DATABASE "${e2eControlDbName()}"`));
  const prisma = require.resolve('prisma/build/index.js');
  execFileSync(process.execPath, [prisma, 'migrate', 'deploy', '--config', 'prisma.control.config.ts'], {
    cwd: ROOT,
    stdio: 'pipe',
    env: process.env,
  });
  await seedControl();
}
