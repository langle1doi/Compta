import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { tenantIdOfToken } from '../../common/crypto/opaque-token';
import { decryptSecret } from '../../common/crypto/secret-box';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { ControlEventsService } from '../../database/control-events.service';
import { ControlPrismaService } from '../../database/control-prisma.service';
import { TenantPrismaClient, TenantPrismaManager } from '../../database/tenant-prisma.manager';
import { Tenant, TenantStatus } from '../../generated/control/client';
import { currentTenant, TenantContextValue, tenantStorage } from './tenant-context';

const CACHE_TTL_MS = 60_000;

/** The only cluster today; its address is TENANT_DB_HOST / TENANT_DB_PORT of the running process. */
export const DEFAULT_DB_CLUSTER = 'default';

type TenantConnection = Pick<Tenant, 'dbCluster' | 'dbName' | 'dbUser' | 'dbPasswordEnc'> &
  Partial<Pick<Tenant, 'dbAppUser' | 'dbAppPasswordEnc'>>;

const invalidToken = () => new AppException(HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_TOKEN, 'Invalid or expired token');

/** Looks up tenants in the control plane and hands out the matching tenant DB client. */
@Injectable()
export class TenantRegistryService {
  private readonly bySubdomain = new Map<string, { tenant: Tenant | null; expiresAt: number }>();
  private readonly byId = new Map<string, { tenant: Tenant | null; expiresAt: number }>();

  constructor(
    private readonly control: ControlPrismaService,
    private readonly manager: TenantPrismaManager,
    private readonly config: ConfigService,
    events: ControlEventsService,
  ) {
    events.subscribe((event) => {
      if (event.kind !== 'tenant') return;
      // The connection pool stays: requests already running must finish (E-TEN-11); an idle pool closes by itself
      this.bySubdomain.delete(event.subdomain);
      this.byId.delete(event.tenantId);
    });
  }

  /** Any status; the caller decides what a non-ACTIVE tenant means. */
  async findBySubdomain(subdomain: string): Promise<Tenant | null> {
    const cached = this.bySubdomain.get(subdomain);
    if (cached && cached.expiresAt > Date.now()) return cached.tenant;
    const tenant = await this.control.tenant.findUnique({ where: { subdomain } });
    this.bySubdomain.set(subdomain, { tenant, expiresAt: Date.now() + CACHE_TTL_MS });
    return tenant;
  }

  async findById(id: string): Promise<Tenant | null> {
    const cached = this.byId.get(id);
    if (cached && cached.expiresAt > Date.now()) return cached.tenant;
    const tenant = await this.control.tenant.findUnique({ where: { id } });
    this.byId.set(id, { tenant, expiresAt: Date.now() + CACHE_TTL_MS });
    return tenant;
  }

  contextOf(tenant: Tenant): TenantContextValue {
    return {
      tenantId: tenant.id,
      subdomain: tenant.subdomain,
      planId: tenant.planId,
      defaultCompanyId: tenant.defaultCompanyId,
      db: this.clientFor(tenant),
    };
  }

  /** Runs `fn` as a request of this tenant: TenantDbService and everything built on it then work. */
  runIn<T>(tenant: Tenant, fn: () => Promise<T>): Promise<T> {
    return tenantStorage.run(this.contextOf(tenant), fn);
  }

  /**
   * Runs `fn` in the tenant a link or refresh token belongs to. On a subdomain it must be that subdomain's tenant
   * (E-PWD-04, E-INV-08). A suspended tenant answers 403 (E-SESS-03); anything else that cannot match answers 401.
   */
  async runForToken<T>(token: string, fn: () => Promise<T>): Promise<T> {
    const tenantId = tenantIdOfToken(token);
    if (!tenantId) throw invalidToken();
    const current = currentTenant();
    if (current) {
      if (current.tenantId !== tenantId) throw invalidToken();
      return fn();
    }
    const tenant = await this.findById(tenantId);
    if (tenant?.status === TenantStatus.SUSPENDED) {
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.TENANT_SUSPENDED, 'Tenant is suspended');
    }
    if (tenant?.status !== TenantStatus.ACTIVE) throw invalidToken();
    return this.runIn(tenant, fn);
  }

  clientFor(tenant: Pick<Tenant, 'id'> & TenantConnection): TenantPrismaClient {
    return this.manager.get(tenant.id, this.connectionString(tenant));
  }

  /** The application role (F16 BR-01). The owner role until migrate-tenants has created it for an older tenant. */
  connectionString(tenant: TenantConnection): string {
    if (tenant.dbAppUser && tenant.dbAppPasswordEnc) {
      return this.url(tenant.dbCluster, tenant.dbAppUser, tenant.dbAppPasswordEnc, tenant.dbName);
    }
    return this.ownerConnectionString(tenant);
  }

  /** The owner role: migrations and grants only. */
  ownerConnectionString(tenant: TenantConnection): string {
    return this.url(tenant.dbCluster, tenant.dbUser, tenant.dbPasswordEnc, tenant.dbName);
  }

  private url(cluster: string, user: string, passwordEnc: string, dbName: string) {
    const { host, port } = this.clusterAddress(cluster);
    const password = decryptSecret(passwordEnc, this.config.getOrThrow('DB_CREDENTIALS_KEY'));
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${dbName}`;
  }

  /** Never falls back to another cluster: connecting a tenant to the wrong server must fail loudly. */
  private clusterAddress(cluster: string): { host: string; port: number } {
    if (cluster !== DEFAULT_DB_CLUSTER) throw new Error(`Unknown database cluster "${cluster}"`);
    return { host: this.config.getOrThrow<string>('TENANT_DB_HOST'), port: this.config.getOrThrow<number>('TENANT_DB_PORT') };
  }
}
