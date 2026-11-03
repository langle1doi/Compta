const DEV_TEMPLATE = 'http://{subdomain}.localhost:3001';

/** Link to a page of the tenant frontend. env validation makes the template mandatory in production. */
export function tenantPublicUrl(template: string | undefined, subdomain: string, path: string): string {
  return `${(template || DEV_TEMPLATE).replace('{subdomain}', subdomain).replace(/\/$/, '')}${path}`;
}
