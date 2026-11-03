# COMPTE BE — CRM Báo giá / Hóa đơn (multi-tenant SaaS)

NestJS 11 · Prisma 7 · PostgreSQL 17 (mỗi tenant một database) · Casbin RBAC · nestjs-pino.
Đặc tả: PRD/FS v0.1 (F01–F19). Mã AC/BR trong code và test tham chiếu tài liệu này.

## Chạy lần đầu

```bash
cp .env.example .env          # sinh DB_CREDENTIALS_KEY và JWT_SECRET thật (lệnh trong file)
npm install                   # tự chạy prisma generate cho 2 schema + cài husky
docker compose up -d          # PostgreSQL 17
npm run db:control:deploy     # migrate DB trung tâm
npm run db:control:seed       # gói dịch vụ + Super Admin + tenant "dfm" mặc định (hệ thống mới)
npm run db:tenants:deploy     # migrate mọi tenant + bổ sung tài khoản mặc định còn thiếu
npm run start:dev             # http://localhost:3000, Swagger: http://localhost:3000/docs
```

## Tài khoản mặc định

Mỗi vai trò có một tài khoản, mật khẩu `123456`, **ở mọi môi trường kể cả production** (quyết định của Product Owner,
ngoại lệ có chủ ý so với F02 BR-01). Khi khởi động, API log cảnh báo (warn) liệt kê các tài khoản còn dùng mật khẩu mặc định.

| Vai trò          | Email                          | Phạm vi                                    | Nơi tạo           |
| ---------------- | ------------------------------ | ------------------------------------------ | ----------------- |
| Super Admin      | `superadmin@platform.local`    | Nền tảng (control DB)                      | `db:control:seed` |
| Admin tenant     | `admin@<subdomain>.local`      | Toàn tenant (membership `company_id` null) | Mỗi tenant        |
| Chủ doanh nghiệp | `owner@<subdomain>.local`      | Pháp nhân đầu tiên                         | Mỗi tenant        |
| Kế toán          | `accountant@<subdomain>.local` | Pháp nhân đầu tiên                         | Mỗi tenant        |
| Sale             | `sales@<subdomain>.local`      | Pháp nhân đầu tiên                         | Mỗi tenant        |
| Người xem        | `viewer@<subdomain>.local`     | Pháp nhân đầu tiên                         | Mỗi tenant        |

- Hệ thống mới (chưa có tenant nào): `db:control:seed` (và job `migrate` của docker-compose) tạo Super Admin + tenant
  `dfm` (gói business, pháp nhân DFM-EUROPE) với đủ 5 tài khoản → `dfm.<APP_BASE_DOMAIN>`.
- Provision tenant mới và `db:tenants:deploy`: thêm tài khoản mặc định **còn thiếu** cho mọi tenant.
- Chỉ tạo khi chưa tồn tại: không ghi đè, không reset mật khẩu, không đổi vai trò của tài khoản đã có. Chạy lại bao nhiêu lần cũng được.
- Tài khoản mặc định ở trạng thái ACTIVE và tính vào giới hạn gói (starter: 10 user).
- Quy tắc mật khẩu ≥ 12 ký tự + không phổ biến chỉ áp khi tạo user / đổi mật khẩu qua API; login và seed không kiểm tra.
- Code: `src/modules/platform/tenants/default-accounts.ts`, `src/cli/seed-control.ts`, `src/cli/migrate-tenants.ts`.

Gọi API (JSON **snake_case**):

```bash
# Super Admin (domain gốc)
curl -X POST localhost:3000/platform/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"superadmin@platform.local","password":"123456"}'
curl -X POST localhost:3000/platform/api/v1/tenants -H "Authorization: Bearer <token>" -H 'Content-Type: application/json' \
  -d '{"name":"Acme","subdomain":"acme","plan_code":"starter","company_legal_name":"ACME SAS",
       "admin_email":"boss@acme.fr","admin_full_name":"Boss","admin_password":"Boss-Password-2026"}'

# Tenant (subdomain)
curl -X POST http://dfm.localhost:3000/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"owner@dfm.local","password":"123456"}'
curl http://dfm.localhost:3000/api/v1/customers -H "Authorization: Bearer <token>" -H "X-Company-Id: <company id>"
```

## Scripts

| Script                                       | Việc                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| `start:dev` / `build` / `start:prod`         | Chạy dev (watch) / build / chạy bản build                                |
| `lint`, `lint:fix`, `format`, `format:check` | ESLint (flat config, type-aware) + Prettier                              |
| `typecheck`                                  | `tsc --noEmit` cho src và test                                           |
| `test`                                       | Unit test (không cần DB)                                                 |
| `test:e2e`                                   | E2E trên PostgreSQL thật, hệ thống mới mỗi lần chạy (DB `*_e2e`, tự xóa) |
| `db:control:migrate` / `db:control:deploy`   | Tạo migration / áp migration DB trung tâm                                |
| `db:control:seed`                            | Build rồi seed: gói dịch vụ, Super Admin, tenant `dfm` nếu hệ thống mới  |
| `db:tenant:migrate -- --name x`              | Tạo migration schema tenant (trên DB dev `TENANT_DATABASE_URL`)          |
| `db:tenants:deploy [-- --tenant=dfm]`        | Build rồi migrate mọi tenant, đồng bộ quyền, thêm tài khoản mặc định     |

Pre-commit (husky + lint-staged): ESLint `--fix` + Prettier trên file đã stage.

## Cấu trúc thư mục

```
prisma/
  control/  schema.prisma (generator+datasource) · models/*.prisma · enums/*.prisma · migrations/
  tenant/   schema.prisma · models/*.prisma · enums/*.prisma · migrations/
            → MỖI MODEL / ENUM MỘT FILE. SQL Prisma không biểu diễn được (CHECK, trigger,
              NULLS NOT DISTINCT) viết tay ở cuối migration, có comment.
src/
  cli/           seed-control, migrate-tenants (build vào dist/cli, chạy được trong container)
  config/        env.validation.ts — validate env, từ chối khởi động production với secret mặc định
  common/        auth decorators · errors (AppException, mã lỗi) · filters · http (app setup, throttle)
                 · logging (pino options, request context) · validation (SIRET, IBAN, mật khẩu)
  database/      ControlPrismaService · TenantPrismaManager (pool/tenant) · ControlEventsService (LISTEN/NOTIFY)
  generated/     Prisma client (gitignored, sinh khi npm install)
  modules/
    tenancy/     subdomain → tenant → DB client (AsyncLocalStorage) · giới hạn gói
    auth/        login tenant, lockout, JWT + token version, kiểm tra user còn ACTIVE mỗi request
    rbac/        Casbin (model.conf, adapter Prisma, enforcer), guard, danh mục quyền, API vai trò
    platform/    Super Admin: auth, users, audit, tenants, plans, jobs, migrations, exports, purge, support
    companies/   pháp nhân + thuế suất
    users/       người dùng, trạng thái, gán vai trò theo pháp nhân
    customers/   khách hàng, liên hệ, địa chỉ, chia sẻ (module mẫu cho các module nghiệp vụ sau)
    numbering/   cấp số liên tục (C00001, DEV/FAC/AV{YYYY}{NNNN})
    health/      /health/live, /health/ready
test/            e2e: platform, isolation, rbac, customers, default-accounts, http, throttle
                 (+ support/, setup/, fixtures/prd-permission-matrix.ts dùng chung với unit test)
```

Mỗi module: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`.

## Quy ước API

- Tiền tố (PRD chương 4): `/api/v1` trên `<tenant>.<APP_BASE_DOMAIN>`, `/platform/api/v1` trên domain gốc, `/health/*` ngoài tiền tố.
- JSON **snake_case** (PRD): body, query, response, tên field trong lỗi. Chuyển đổi ở tầng chung
  (`SnakeCaseRequestPipe` → camelCase cho DTO, `SnakeCaseResponseInterceptor` → snake_case); code TS/Prisma giữ camelCase.
  Key camelCase từ client bị từ chối (422, code `snakeCase`). Swagger cũng hiển thị snake_case.
- Pháp nhân đang chọn: header `X-Company-Id` — phải tồn tại, `ACTIVE`, và user có membership ở đó.
- Lỗi luôn có dạng:
  ```json
  {
    "status_code": 422,
    "code": "VALIDATION_FAILED",
    "message": "...",
    "fields": [{ "field": "siret", "code": "isSiret", "message": "..." }],
    "request_id": "..."
  }
  ```
  Không bao giờ trả stack, SQL hay lỗi Prisma. Danh sách mã: `src/common/errors/error-codes.ts`
  (VD `TENANT_SUSPENDED`, `ACCOUNT_LOCKED` 423, `PLAN_LIMIT_REACHED` 402, `LAST_ADMIN` 409, `OUT_OF_SCOPE` 403).
- Input sai → 422 theo từng field; field lạ bị từ chối.

## Multi-tenant

- Tenant xác định **chỉ** từ subdomain; JWT mang `tid` phải trùng (sai → 401 `WRONG_TENANT`).
- Mỗi tenant: 1 database + 1 role Postgres riêng; role không CONNECT được DB khác hay DB trung tâm (test trong `isolation.e2e-spec.ts`).
  Mật khẩu DB mã hóa AES-256-GCM trong control DB.
- Tenant chỉ lưu **cụm logic** `db_cluster` (hiện chỉ có `default`), không lưu host/port. Địa chỉ lấy lúc chạy từ `TENANT_DB_HOST` / `TENANT_DB_PORT`
  của tiến trình đang chạy (`localhost` ngoài container, `postgres` trong docker compose), nên cùng dữ liệu chạy được cả trong lẫn ngoài container.
  `db_cluster` không xác định → báo lỗi (API trả 500 chung, log ghi rõ), không tự rơi về `default`.
  **Lệch PRD chương 5** (`TENANT_DB` có `host`) theo quyết định của người dùng: host là cấu hình hạ tầng, không phải dữ liệu của tenant.
- Vòng đời (F01 BR-03): `PROVISIONING → ACTIVE ⇄ SUSPENDED → DELETED`, `PROVISIONING → FAILED → PROVISIONING` (retry); sai → 409.
  Muốn xóa một tenant đang ACTIVE phải tạm khóa (SUSPENDED) trước.
  `SUSPENDED` → mọi request 403 `TENANT_SUSPENDED`. Provisioning lỗi → dọn DB/role, trạng thái `FAILED` + `failure_reason`.
- Giới hạn gói (users, pháp nhân) kiểm tra ở backend → 402 `PLAN_LIMIT_REACHED`.

## RBAC (Casbin)

`src/modules/rbac/casbin/model.conf` — RBAC theo domain (domain = pháp nhân) + phạm vi dữ liệu `OWN < COMPANY < TENANT`.

| Khái niệm         | Bảng                                      | Dòng Casbin                                          |
| ----------------- | ----------------------------------------- | ---------------------------------------------------- |
| Quyền của vai trò | `role_permissions` (role, perm, scope)    | `p, role:<id>, customer, read, OWN`                  |
| Gán vai trò       | `memberships` (user, company\|null, role) | `g, user:<id>, role:<id>, company:<id>` (null → `*`) |

- Adapter **chỉ đọc**: bảng DB là nguồn sự thật. Sửa qua API rồi `EnforcerService.policyChanged()` → NOTIFY → mọi instance reload ngay.
- Membership gắn **một** pháp nhân không bao giờ đạt scope `TENANT`, dù vai trò cấp TENANT (chống leo thang quyền).
- Không wildcard. Vai trò hệ thống theo ma trận PRD §1.8, không sửa được; test `permission-catalog.spec.ts` khóa từng ô vai trò × quyền.
- Mặc định từ chối: route phải có `@RequirePermission(resource, action)`, `@AuthOnly()` hoặc `@Public()`.
- Ngoài phạm vi OWN → 403 `OUT_OF_SCOPE` (F04 AC-03); user bị vô hiệu hóa → token bị thu hồi ngay (token version), request kế tiếp 401.

```ts
@Get()
@RequirePermission('customer', 'read')
list(@Access() access: AccessContext) { ... }   // access = { userId, companyId, scope }
```

## Logging, bảo mật HTTP, vận hành

- Log JSON có cấu trúc (pino), `LOG_PRETTY=true` khi dev. Mỗi request có `X-Request-Id` (nhận từ gateway nếu hợp lệ, không thì tự sinh, luôn trả lại).
  Log kèm `tenant`, `tenantId`, `userId`, `companyId`. Header auth/cookie không bao giờ được ghi; các key nhạy cảm (`password`, `mfaSecret`, `dbPasswordEnc`, `connectionString`…) bị redact.
- helmet, CORS cho `*.APP_BASE_DOMAIN` + `CORS_ORIGINS`, rate limit `THROTTLE_DEFAULT_LIMIT`/phút/IP và `THROTTLE_LOGIN_LIMIT`/phút/IP cho login; lockout 5 lần sai / 15 phút → 423 (tenant user và Super Admin).
- Health: `/health/live` (process), `/health/ready` (503 chỉ khi control DB lỗi; RabbitMQ hoặc MinIO hỏng vẫn 200 kèm `status: degraded`). Swagger `/docs` chỉ bật ngoài production.
- Graceful shutdown: SIGTERM → đóng HTTP server, pool tenant, listener.
- Production từ chối khởi động nếu `JWT_SECRET`/`DB_CREDENTIALS_KEY` còn giá trị mẫu hoặc `LOG_PRETTY=true`.
- `TENANT_DB_NAME_PREFIX` (mặc định `tenant_`): nhiều môi trường dùng chung một cụm PostgreSQL mà không trùng tên DB.

## Docker

```bash
docker compose --profile app up -d --build   # postgres → job migrate (control + seed + tenants) → app (non-root, healthcheck)
```

### Cổng mở trên host

Mặc định compose mở các cổng sau trên **mọi interface** của máy, với mật khẩu dev mặc định ở các dịch vụ hạ tầng. Trên mạng dùng chung, ai cùng mạng đều kết nối được.

| Biến cổng                  | Mặc định | Dịch vụ             | Ai cần                         | Theo `INFRA_BIND_ADDRESS` | Production        |
| -------------------------- | -------- | ------------------- | ------------------------------ | ------------------------- | ----------------- |
| `APP_PORT`                 | 3000     | API                 | FE proxy                       | Không                     | Sau reverse proxy |
| `MINIO_PORT`               | 9000     | MinIO API           | Trình duyệt tải file presigned | Không                     | Sau reverse proxy |
| `POSTGRES_PORT`            | 5432     | PostgreSQL          | Chạy API ngoài container       | Có                        | **Không publish** |
| `RABBITMQ_PORT`            | 5672     | RabbitMQ AMQP       | Chạy API ngoài container       | Có                        | **Không publish** |
| `RABBITMQ_MANAGEMENT_PORT` | 15672    | RabbitMQ management | Dev xem hàng đợi               | Có                        | **Không publish** |
| `MINIO_CONSOLE_PORT`       | 9001     | MinIO console       | Dev xem file                   | Có                        | **Không publish** |
| `MAILPIT_SMTP_PORT`        | 1025     | Mailpit SMTP        | Chạy API ngoài container       | Có                        | **Không chạy**    |
| `MAILPIT_UI_PORT`          | 8025     | Mailpit giao diện   | Dev đọc mail thử               | Có                        | **Không chạy**    |

- Dev một mình: đặt `INFRA_BIND_ADDRESS=127.0.0.1` trong `.env` để các cổng hạ tầng chỉ mở cho chính máy này. Mặc định `0.0.0.0` giữ nguyên hành vi cũ. Đổi biến này rồi `up` lại sẽ tạo lại các container đó; volume vẫn giữ.
- **Production không được publish RabbitMQ (cả 2 cổng), MinIO console, Mailpit**, và cả PostgreSQL. File compose này dành cho dev: production cần cấu hình riêng không có các cổng đó và không có Mailpit, kèm `APP_NODE_ENV=production` và mật khẩu thật (ứng dụng từ chối khởi động nếu còn mật khẩu mặc định).
- `S3_PUBLIC_ENDPOINT` là địa chỉ ghi vào link tải: mặc định `http://localhost:<MINIO_PORT>` chỉ mở được trên chính máy này; máy khác cùng mạng thì đặt IP LAN.

## Hàng đợi, mail, lưu trữ

- **RabbitMQ** (`src/modules/queue`): queue bền, message persistent, ack thủ công, retry có backoff qua `QUEUE_RETRY_DELAYS_MS`, dead-letter `<prefix>.<queue>.dlq`, tự nối lại. `WORKER_ENABLED=false` để một replica chỉ phục vụ HTTP. Job dài giữ message chưa ack: broker phải đặt `consumer_timeout` đủ lớn (compose đặt 4 giờ; mặc định của RabbitMQ là 30 phút).
- **Mail** (`src/modules/mail`): outbox trong `mail_jobs`, nội dung mã hóa; RabbitMQ chỉ chở id nên token không tới broker. Không cấu hình `MAIL_HOST` thì không gửi, dòng ghi `SKIPPED`, API mời trả `invite_url`. Link luôn dựng từ `APP_PUBLIC_URL_TEMPLATE`, không từ Host. E2e ép về Mailpit, và env validation từ chối SMTP thật khi `NODE_ENV=test`.
- **Lưu trữ** (`src/modules/storage`): chuẩn S3 trỏ MinIO, file nằm dưới `tenants/<tenant_id>/`, link presigned, bucket tự tạo. Tính năng cần file nhận 503 `STORAGE_UNAVAILABLE` khi MinIO hỏng.
- **Readiness**: `/health/ready` chỉ trả 503 khi control DB lỗi. RabbitMQ hoặc MinIO hỏng vẫn 200 với `{status: "degraded", components: {control_db, broker, storage}}`, vì đăng nhập và đa số nghiệp vụ vẫn chạy (mail chờ trong outbox); rút mọi pod khỏi load balancer sẽ làm cả hệ thống sập. Cảnh báo dựa vào log và metric `broker_connected`, `storage_reachable`, không dựa vào readiness. Trạng thái MinIO có thể trễ tới 10 giây. `/health/live` không phụ thuộc gì.
- **IP thật**: frontend proxy gửi `X-Client-Ip` kèm `X-Internal-Proxy-Secret` (`INTERNAL_PROXY_SECRET`, so sánh hằng thời gian, bắt buộc ở production). Không có `trust proxy`; `X-Forwarded-*` bị bỏ qua.
- `GET /metrics`: định dạng Prometheus, cần `Authorization: Bearer <METRICS_TOKEN>`; thiếu hoặc sai trả 404. Sentry bật khi có `SENTRY_DSN`, không gửi request, header, body.

## Đăng nhập (F02)

- Access token 15 phút, refresh token 7 ngày, opaque, chỉ lưu hash, xoay vòng mỗi lần dùng. Phiên hết khi không hoạt động 30 phút hoặc quá 12 giờ.
- Dùng lại refresh token cũ thu hồi cả phiên. Ngoại lệ có chủ đích: trong `REFRESH_REUSE_GRACE_SECONDS` (mặc định 10) cùng user-agent được coi là hai tab cùng refresh, không phải bị đánh cắp. Đặt 0 để tắt.
- Token không chứa company_ids và roles (lệch PRD BR-04, có chủ đích): quyền đọc từ server mỗi request nên đổi vai trò có hiệu lực ngay.
- Mã 2FA sai tính vào cùng bộ đếm khóa với mật khẩu sai, theo từng user (không theo IP): 5 lần trong 15 phút thì khóa. Đăng nhập lại đúng mật khẩu không xóa bộ đếm; chỉ qua đủ cả 2 bước mới xóa. Quy tắc này áp cho mọi chỗ thử mật khẩu hoặc mã: `/auth/login`, `/auth/unified-login`, `/auth/mfa/verify`, và cả sau khi đã có phiên (`/me/password`, `/me/mfa/disable`), để phiên bị đánh cắp không dò được; khi khóa, giá trị đúng cũng bị từ chối.
- **Rủi ro đã chấp nhận**: ai biết mật khẩu có thể cố ý nhập sai mã để khóa tài khoản nạn nhân 15 phút. Vì kẻ đó đã phải biết mật khẩu, và mail cảnh báo gửi cho chủ tài khoản đúng là điều mong muốn: người nhận mail nên đổi mật khẩu.
- 2FA TOTP bắt buộc với Admin, Chủ DN, Kế toán khi `MFA_ENFORCED=true`; tenant bật cho mọi user bằng `PATCH /api/v1/tenant/settings`. Admin không tự reset 2FA của mình. Admin cuối mất cả thiết bị lẫn mã khôi phục: chạy `node dist/cli/reset-user-mfa.js --tenant=<subdomain> --email=<email>` trên server.

## Audit (F16)

- Thao tác nhạy cảm (đổi mật khẩu, 2FA, vai trò, trạng thái user, reassign) ghi audit trong cùng transaction: không ghi được thì thao tác thất bại. Các ghi khác ghi sau khi xong: lỗi audit chỉ log error, thao tác vẫn thành công. Request thất bại không tạo dòng, trừ sự kiện đăng nhập.
- API kết nối bằng role `<db_user>_app`: không sở hữu bảng, chỉ INSERT và SELECT trên `audit_logs`. Migration chạy bằng role chủ `<db_user>`. **Giới hạn còn lại**: role chủ và superuser PostgreSQL vẫn sửa được `audit_logs`; cần giám sát hoặc đẩy log ra ngoài nếu muốn chống cả quản trị viên DB. Tenant cũ chuyển sang role này khi chạy `db:tenants:deploy`.
- **Giữ 10 năm**: audit log không có job tự xóa. Xóa chỉ bằng quyết định có chủ đích của quản trị hệ thống, sau thời hạn 10 năm.
- Thùng rác khách hàng: `GET /customers/trash`, `POST /customers/:id/restore`. Chứng từ chờ module Báo giá và Hóa đơn.

## Super Admin (F01)

API dưới `/platform/api/v1` trên domain gốc. Token ký bằng `PLATFORM_JWT_SECRET` với issuer và audience riêng; token tenant và token Platform từ chối lẫn nhau (401).

**Vai trò** (`src/modules/rbac/platform-catalog.ts`, Casbin domain `platform`, đọc từ bảng control, không wildcard, từ chối mặc định, thu hồi ngay qua NOTIFY). Chỉ `superadmin@platform.local` là tài khoản mặc định.

| Vai trò                | Quyền                                                                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PLATFORM_SUPER_ADMIN` | Toàn bộ                                                                                                                                                           |
| `PLATFORM_OPERATOR`    | Xem, tạo, thử lại, tạm khóa, mở khóa tenant, đổi gói, CRUD gói, xem job, migration. **Không**: xóa tenant, xuất dữ liệu, vào tenant, quản lý tài khoản, xem audit |
| `PLATFORM_SUPPORT`     | Chỉ xem tenant, gói, job, migration                                                                                                                               |

- **Tạo tenant** trả 202 `{tenant, job_id}`; theo dõi `GET /jobs/:id`, các bước `create_database → migrate → seed → invite`. Dòng job là outbox, RabbitMQ chỉ chở id: broker sập vẫn trả 202, sweeper gửi lại. Worker chết giữa chừng thì message giao lại và chạy lại từ đầu trên phần còn sót của chính nó; quá 15 phút không xong thì `FAILED`, thử lại được. `seed-control` chạy cùng các bước ngay trong tiến trình và làm job deploy thất bại khi lỗi.
- **Dọn dẹp chỉ xóa thứ của mình** (E-TEN-04): role mang comment `compte-tenant:<tenant_id>`, ghi cùng transaction với `CREATE ROLE`; DB được coi là của mình khi role đó sở hữu. DB hoặc role cùng tên có sẵn thì giữ nguyên và tenant `FAILED`; gỡ chúng đi rồi thử lại. `failure_reason` không chứa thông báo của driver, chi tiết nằm trong log.
- **Mời Admin đầu tiên**: không gửi `admin_password` thì mời qua email. `POST /tenants/:id/resend-invite`; không cấu hình mail thì trả `invite_url` đúng lần gọi đó, không lưu và không ghi audit. Link dựng từ `APP_PUBLIC_URL_TEMPLATE`.
- **Danh sách**: usage lấy từ `tenant_usage_snapshots`, làm mới ngay khi khởi động, sau mỗi lần provisioning và 15 phút một lần (một pod chạy, tuần tự, một kết nối ngắn cho mỗi tenant), nên danh sách không mở DB tenant nào. DB không đọc được thì `usage: null`, các tenant khác không bị ảnh hưởng.
- **Dung lượng**: `usage.storage_bytes = database_bytes + files_bytes` và đây là con số so với `max_storage_gb`. `database_bytes` là `pg_database_size`, nên tenant mới đã có vài MB do schema; `files_bytes` là file trên MinIO, không tính bản xuất dữ liệu. `counts` là tổng toàn nền tảng, không theo bộ lọc.
- **Khóa, xóa** cần `confirm_name` trùng khớp chính xác tên tenant (phân biệt hoa thường, không cắt khoảng trắng), sai thì 422. Chỉ provisioning mới đưa được tenant ra khỏi `PROVISIONING`.
- **Gói**: hạ gói dưới mức đang dùng vẫn được, dữ liệu cũ xem được, chỉ chặn tạo mới; response có `over_limits`. Gói đang dùng không xóa và không đổi `code` được (409 `PLAN_IN_USE`). Seed không ghi đè giới hạn đã sửa.
- **Migration**: `POST /migrations/run {tenant_ids?}` trả 202, chạy tuần tự, mỗi tenant một kết quả, tenant lỗi không chặn tenant khác, cả nền tảng chỉ một lần chạy (409 `JOB_ALREADY_RUNNING`). Không có rollback bằng `target_version`. Job `SUCCEEDED` kể cả khi có tenant lỗi: xem `result.failed` và `result.results`.
- **Xuất dữ liệu**: `POST /platform/api/v1/tenants/:id/export` (chỉ khi SUSPENDED hoặc DELETED) và `POST /api/v1/tenant/export` (`settings.manage`). Zip NDJSON từ một snapshot đọc nhất quán, ghi ra đĩa qua cursor. Không chứa bảng phiên, token, mời, 2FA, khóa idempotency và các cột mật khẩu, hash, secret, token. Link presigned hết hạn sau 24 giờ, đọc lại không gia hạn; `GET /jobs/:id` không bao giờ trả link. Zip bị xóa khỏi MinIO ngay khi link hết hạn (quét 15 phút một lần), vì chứa dữ liệu khách hàng; cần lại thì xuất lại. Bản xuất không tính vào dung lượng gói.
- **Purge**: `TENANT_PURGE_ENABLED=false` mặc định. Khi bật: mỗi giờ, một pod (advisory lock), tenant DELETED quá 30 ngày và có bản xuất thành công làm sau lúc tenant bị khóa (bản cũ hơn thiếu dữ liệu cuối): xóa file, DB, role, rồi xóa dòng tenant (giải phóng subdomain). `platform_audit_logs` được giữ lại.
- **Phiên hỗ trợ** (BR-05): Admin tenant `POST /api/v1/support-sessions {duration_hours: 1..24, reason?}`, xem và thu hồi bằng `GET`, `DELETE`. Mỗi tenant một phiên còn hiệu lực (409). Super Admin `POST /platform/api/v1/tenants/:id/support-sessions/enter` lấy token dùng trên subdomain của tenant. **Phiên chỉ đọc** (chọn phương án an toàn hơn): mọi route không phải GET, route hồ sơ (`/auth/me`, `/me`) và xuất dữ liệu đều 403; `GET /companies` mở để chọn pháp nhân. Token sống bằng thời hạn của phiên và không có refresh; mỗi request kiểm tra lại DB, nên thu hồi, hết hạn hay Super Admin mất quyền đều có tác dụng ngay; tenant bị khóa thì phiên cũng bị chặn, mở khóa thì dùng lại được. Ghi audit ở cả `platform_audit_logs` và `audit_logs` của tenant.
- **`platform_audit_logs`**: trigger chặn UPDATE, DELETE, TRUNCATE. Ghi mọi thay đổi trong cùng transaction, cùng đăng nhập thành công và thất bại. Không ghi các request GET (trừ phiên hỗ trợ) và các request thay đổi bị từ chối.

## Chưa làm (đợt sau)

| Hạng mục                                                                                                                             | Ghi chú                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| F02: refresh token (15 phút / 7 ngày, cookie HttpOnly), đăng xuất, quản lý phiên, quên mật khẩu, 2FA TOTP bắt buộc theo vai trò, SSO | Hiện chỉ có access token; `JWT_EXPIRES_IN=15m`, thu hồi bằng `token_version` |
| F03: tra cứu SIRET, cấu hình tenant (`tenant_settings`), logo, đổi định dạng số chứng từ                                             | Bảng `number_sequences.format` đã sẵn                                        |
| F06: phát hiện trùng, import CSV, ghi chú/hoạt động, chuyển khách hàng hàng loạt (`/customers/reassign`)                             |                                                                              |
| F07–F12: sản phẩm, báo giá, hóa đơn, avoir, thanh toán, email/PDF                                                                    | Schema đã có (snapshot JSON, `lock_version`, đơn giá numeric(14,4))          |
| Nhiều cụm DB: map tên cụm → địa chỉ (`TENANT_DB_CLUSTERS`) khi chia tenant sang nhiều cụm (NFR Scalability)                          | Hiện chỉ có cụm `default`                                                    |
| Hạ tầng: PgBouncer trước Postgres, throttler storage Redis khi chạy nhiều instance, secrets manager cho khóa DB, Sentry/metrics      |                                                                              |
