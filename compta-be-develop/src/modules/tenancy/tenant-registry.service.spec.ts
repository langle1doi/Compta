import type { ConfigService } from '@nestjs/config';
import { encryptSecret } from '../../common/crypto/secret-box';
import type { ControlEventsService } from '../../database/control-events.service';
import type { ControlPrismaService } from '../../database/control-prisma.service';
import type { TenantPrismaManager } from '../../database/tenant-prisma.manager';
import { DEFAULT_DB_CLUSTER, TenantRegistryService } from './tenant-registry.service';

const KEY = Buffer.alloc(32, 7).toString('base64');

function setup(env: Record<string, unknown>) {
  const manager = { get: jest.fn().mockReturnValue('client'), evict: jest.fn() };
  const config = {
    getOrThrow: (key: string) => {
      const all: Record<string, unknown> = { DB_CREDENTIALS_KEY: KEY, ...env };
      if (all[key] === undefined) throw new Error(`Missing ${key}`);
      return all[key];
    },
  };
  const registry = new TenantRegistryService(
    {} as ControlPrismaService,
    manager as unknown as TenantPrismaManager,
    config as unknown as ConfigService,
    { subscribe: () => undefined } as unknown as ControlEventsService,
  );
  return { registry, manager };
}

const row = (dbCluster: string, password = 'p@ss/word') => ({
  id: 't1',
  dbCluster,
  dbName: 'tenant_dfm',
  dbUser: 'tenant_dfm',
  dbPasswordEnc: encryptSecret(password, KEY),
});

describe('TenantRegistryService.connectionString', () => {
  it('takes host and port of the default cluster from the environment, so one row works inside and outside a container', () => {
    const tenant = row(DEFAULT_DB_CLUSTER);
    const outside = setup({ TENANT_DB_HOST: 'localhost', TENANT_DB_PORT: 5432 }).registry.connectionString(tenant);
    const inside = setup({ TENANT_DB_HOST: 'postgres', TENANT_DB_PORT: 6432 }).registry.connectionString(tenant);

    expect(new URL(outside)).toMatchObject({ hostname: 'localhost', port: '5432', pathname: '/tenant_dfm', username: 'tenant_dfm' });
    expect(new URL(inside)).toMatchObject({ hostname: 'postgres', port: '6432', pathname: '/tenant_dfm', username: 'tenant_dfm' });
  });

  it('decrypts and URL-encodes the password', () => {
    const url = setup({ TENANT_DB_HOST: 'localhost', TENANT_DB_PORT: 5432 }).registry.connectionString(row(DEFAULT_DB_CLUSTER));
    expect(decodeURIComponent(new URL(url).password)).toBe('p@ss/word');
  });

  it('fails on an unknown cluster instead of falling back to the default one', () => {
    const { registry, manager } = setup({ TENANT_DB_HOST: 'localhost', TENANT_DB_PORT: 5432 });
    expect(() => registry.connectionString(row('eu-2'))).toThrow('Unknown database cluster "eu-2"');
    expect(() => registry.clientFor(row('eu-2'))).toThrow('Unknown database cluster "eu-2"');
    expect(manager.get).not.toHaveBeenCalled();
  });

  it('hands the resolved connection to the client manager', () => {
    const { registry, manager } = setup({ TENANT_DB_HOST: 'localhost', TENANT_DB_PORT: 5432 });
    expect(registry.clientFor(row(DEFAULT_DB_CLUSTER))).toBe('client');
    expect(manager.get).toHaveBeenCalledWith('t1', expect.stringContaining('@localhost:5432/tenant_dfm'));
  });
});
