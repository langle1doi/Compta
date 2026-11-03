import { isExportedColumn, isExportedTable } from './tenant-export-writer';

describe('what a tenant export may contain (E-EXP-01)', () => {
  it.each([
    'sessions',
    'refresh_tokens',
    'password_resets',
    'invitations',
    'user_mfa',
    'mfa_recovery_codes',
    'idempotency_keys',
    '_prisma_migrations',
  ])('leaves out table %s', (table) => {
    expect(isExportedTable(table)).toBe(false);
  });

  it.each(['users', 'customers', 'invoices', 'quotes', 'audit_logs', 'payments', 'products', 'companies'])('keeps table %s', (table) => {
    expect(isExportedTable(table)).toBe(true);
  });

  it.each([
    'password_hash',
    'token_hash',
    'code_hash',
    'totp_secret_enc',
    'public_token',
    'token_version',
    'mfa_enabled',
    'api_secret',
    'db_password_enc',
  ])('leaves out column %s', (column) => {
    expect(isExportedColumn(column)).toBe(false);
  });

  it.each(['id', 'email', 'full_name', 'status', 'recovery_fee', 'created_at'])('keeps column %s', (column) => {
    expect(isExportedColumn(column)).toBe(true);
  });
});
