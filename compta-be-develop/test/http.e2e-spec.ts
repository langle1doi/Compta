import { NestExpressApplication } from '@nestjs/platform-express';
import { Api, createTestApp } from './support/app';

describe('HTTP foundation', () => {
  let app: NestExpressApplication;
  let api: Api;

  beforeAll(async () => {
    app = await createTestApp();
    api = new Api(app);
  });
  afterAll(() => app.close());

  it('health: live and ready (control DB) outside the API prefix', async () => {
    expect((await api.call('get', '/health/live')).body.status).toBe('ok');
    const ready = await api.call('get', '/health/ready');
    expect(ready.status).toBe(200);
    expect(ready.body.components.control_db).toBe('up');
  });

  it('echoes a valid X-Request-Id, generates one otherwise, and puts it in error bodies', async () => {
    const given = await api.call('get', '/api/v1/nope', { headers: { 'X-Request-Id': 'abc-123' } });
    expect(given.headers['x-request-id']).toBe('abc-123');
    expect(given.body).toEqual({ status_code: 404, code: 'NOT_FOUND', message: expect.any(String), request_id: 'abc-123' });

    const unsafe = await api.call('get', '/api/v1/nope', { headers: { 'X-Request-Id': 'bad id<script>' } });
    expect(unsafe.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('answers 401 with the unified error format on protected tenant routes', async () => {
    const res = await api.call('get', '/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ status_code: 401, code: 'UNAUTHORIZED', request_id: expect.any(String) });
    expect(res.body).not.toHaveProperty('stack');
  });

  it('answers 422 with per-field errors on invalid input', async () => {
    const res = await api.call('post', '/platform/api/v1/auth/login', { body: { email: 'not-an-email', extra: 1 } });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.fields.map((f: { field: string }) => f.field)).toEqual(expect.arrayContaining(['email', 'password', 'extra']));
  });

  it('answers 400 on malformed JSON without leaking parser internals', async () => {
    const res = await api.call('post', '/platform/api/v1/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
    expect(JSON.stringify(res.body)).not.toMatch(/at JSON\.parse|node_modules/);
  });

  it('sends security headers and allows CORS only for *.APP_BASE_DOMAIN', async () => {
    const ok = await api.call('get', '/health/live', { headers: { Origin: 'https://dfm.localhost' } });
    expect(ok.headers['access-control-allow-origin']).toBe('https://dfm.localhost');
    expect(ok.headers['x-content-type-options']).toBe('nosniff');
    const evil = await api.call('get', '/health/live', { headers: { Origin: 'https://evil.example' } });
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('serves the OpenAPI document outside production', async () => {
    const res = await api.call('get', '/docs-json');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.paths)).toEqual(expect.arrayContaining(['/api/v1/customers', '/platform/api/v1/tenants']));
    // DTO schemas and query parameters are documented in snake_case, like the wire format
    const tenantSchema = res.body.components.schemas.CreateTenantDto;
    expect(Object.keys(tenantSchema.properties)).toEqual(expect.arrayContaining(['company_legal_name', 'admin_password']));
    expect(tenantSchema.required).toContain('admin_email');
    const listParams = res.body.paths['/api/v1/customers'].get.parameters.map((p: { name: string }) => p.name);
    expect(listParams).toContain('page_size');
    expect(listParams.filter((n: string) => n !== 'X-Company-Id' && /[A-Z]/.test(n))).toEqual([]);
  });
});
