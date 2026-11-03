# COMPTE Frontend

Frontend for COMPTE, a business management SaaS (COMPTA-FE).

## Stack

- Next.js App Router, React, TypeScript (strict)
- Tailwind CSS and shadcn/ui configuration
- TanStack Query, React Hook Form, Zod
- next-intl foundation dependency
- date-fns, Lucide React
- ESLint and Prettier

## Development

```bash
npm install
copy .env.example .env.local
npm run dev
```

The app listens on port 3001 on every network interface (`npm run dev` and `npm run start`), because the
backend uses port 3000. The port must be allowed by the machine's firewall for other machines on the LAN.

Each company has its own address: `<tenant>.<domain>` for a domain listed in `FE_BASE_DOMAINS` (see
`.env.example`), for example `http://acme.192.168.30.13.nip.io:3001`. `platform.<domain>` opens the Super Admin
portal. An address outside those domains, such as a bare IP, opens the company set in `TENANT_SUBDOMAIN`.

The browser only talks to this app. Route handlers under `src/app/api` forward to `BACKEND_URL` and set the
tenant through the `Host` header (`<tenant>.<APP_BASE_DOMAIN>`), with the access token kept in an HttpOnly cookie.
Each address has its own cookie, so companies and the portal never share a session.

## Checks

```bash
npm run lint
npm run typecheck
npm run format:check
npm run build
```
