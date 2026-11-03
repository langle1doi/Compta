import { sanitizeAudit } from './sanitize';

describe('sanitizeAudit', () => {
  it('removes secrets at any depth and keeps the rest', () => {
    const at = new Date('2026-01-01T00:00:00Z');
    expect(
      sanitizeAudit({
        email: 'a@b.test',
        password: 'x',
        newPassword: 'x',
        current_password: 'x',
        passwordHash: 'x',
        refreshToken: 'x',
        token_hash: 'x',
        mfaSecret: 'x',
        totpSecretEnc: 'x',
        dbPasswordEnc: 'x',
        dbName: 'x',
        db_user: 'x',
        connectionString: 'x',
        inviteUrl: 'x',
        recoveryCodes: ['x'],
        nested: [{ apiKey: 'x', status: 'ACTIVE', at }],
      }),
    ).toEqual({ email: 'a@b.test', nested: [{ status: 'ACTIVE', at: at.toISOString() }] });
  });

  const kept = (key: string) => key in (sanitizeAudit({ [key]: 'x' }) as Record<string, unknown>);

  it.each([
    // pass, password
    'pass',
    'password',
    'PASSWORD',
    'passwordHash',
    'new_password',
    'bypass',
    'passport',
    // token, secret, hash
    'token',
    'accessToken',
    'token_version',
    'SECRET',
    'mfa_secret',
    'hash',
    'codeHash',
    // ends with enc
    'enc',
    'ENC',
    'secretEnc',
    'db_password_enc',
    'payload_enc',
    // api key, with or without the underscore
    'apikey',
    'apiKey',
    'api_key',
    'API_KEY',
    'x_api_key',
    // credential, connection
    'credential',
    'credentials',
    'dbCredentials',
    'connection',
    'connectionString',
    'CONNECTION_URL',
    // starts with db and something more
    'db_name',
    'dbName',
    'dbUser',
    'DB_HOST',
    'dbx',
    // invite url, with or without the underscore
    'inviteurl',
    'inviteUrl',
    'invite_url',
    'INVITE_URL',
    // recovery
    'recovery',
    'recoveryCodes',
    'mfa_recovery',
    // mfa code, with or without the underscore
    'mfacode',
    'mfaCode',
    'mfa_code',
    'MFA_CODE',
    // exactly code, exactly otp
    'code',
    'CODE',
    'otp',
    'OTP',
  ])('removes the key %s', (key) => {
    expect(kept(key)).toBe(false);
  });

  it.each([
    'email',
    'name',
    'status',
    'action',
    // Close to a secret key, and not one
    'db',
    'DB',
    'adb_name',
    'encrypted',
    'encoding',
    'zipcode',
    'postal_code',
    'codeName',
    'otpx',
    'hotp',
    'api_count',
    'invite',
    'url',
    'mfa',
    'mfaEnabled',
    'api',
  ])('keeps the key %s', (key) => {
    expect(kept(key)).toBe(true);
  });
});
