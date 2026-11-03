/**
 * Recovery for the last Admin of a tenant who lost both the device and the recovery codes (E-MFA-05): nobody else can
 * reset them through the API. Needs server access, ends the user's sessions and leaves an audit row.
 * Usage: npm run cli:reset-user-mfa -- --tenant=<subdomain> --email=<email>
 *        (container: node dist/cli/reset-user-mfa.js --tenant=<subdomain> --email=<email>)
 */
import { MfaService } from '../modules/auth/mfa.service';
import { SYSTEM_ACTOR } from '../modules/audit/audit.types';
import { TenantRegistryService } from '../modules/tenancy/tenant-registry.service';
import { runCli, withAppContext } from './cli-context';

export function resetUserMfa(subdomain: string, email: string): Promise<void> {
  return withAppContext(async (app) => {
    const registry = app.get(TenantRegistryService);
    const tenant = await registry.findBySubdomain(subdomain);
    if (!tenant) throw new Error(`Unknown tenant: ${subdomain}`);
    await registry.runIn(tenant, async () => {
      const user = await registry.clientFor(tenant).user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true } });
      if (!user) throw new Error('Unknown user');
      await app.get(MfaService).adminReset(user.id, SYSTEM_ACTOR);
    });
  });
}

if (require.main === module) {
  const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
  const [tenant, email] = [arg('tenant'), arg('email')];
  if (!tenant || !email) throw new Error('Usage: --tenant=<subdomain> --email=<email>');
  runCli(() => resetUserMfa(tenant, email));
}
