# ADR 0004: Authentication & Authorization

**Status:** Accepted (authorization model amended 2026-05-30 — see "Authorization: RBAC"; client token delivery amended 2026-06-02 — see "Short-lived access token" decision)

## Decisions

**Three separate auth flows, one per actor type.**
Three distinct tables (`admin_users`, `merchant_users`, `users`) each have their own login endpoint and issue scoped JWTs. A shared auth flow was rejected: the three actor types have different credentials (email+password for admins, phone+password for merchant employees, phone+OTP for clients), different session scopes (platform-wide vs merchant-scoped vs client-scoped), and different security requirements. Mixing them would require type-conditional logic throughout every route guard.

**Client self-registration: phone → OTP → PINFL → MyID verification.**
The `users` table is populated through a self-registration wizard:
1. `POST /auth/client/register/phone` — Client enters phone, OTP is sent
2. `POST /auth/client/register/otp` — OTP verified
3. `POST /auth/client/register/pinfl` — PINFL validated for uniqueness; MyID session initiated
4. MyID iframe shown; `POST /auth/client/register/complete` — MyID callback creates `users` row

PINFL uniqueness is enforced at step 3 — a duplicate PINFL returns an error before MyID is reached.

**The Deal Wizard is independent of portal registration.**
An Agent can run the Wizard for any Client by PINFL without that Client having a `users` row. The Client Portal is a separate concern. `users.pinfl` is the join key between a portal identity and Deals — a Client can accumulate Deals before ever registering on the portal.

**Single-role JWT for merchant sessions with login picker.**
An Employee can hold multiple Roles. If more than one Role is assigned, a role picker screen is shown after credential verification. The JWT is issued only after role selection and carries exactly one `role` claim. Switching roles requires re-authentication. Rejected: embedding all roles in the JWT and sending the desired role per-request — this leaks role enforcement logic into every route handler instead of the middleware layer.

**Merchant JWT carries `merchant_id`, `branch_id`, and `role`.**
All three values are known at login time (an Employee always belongs to exactly one Branch). Embedding them in the JWT eliminates a DB round-trip per request to resolve merchant scope. API route guards enforce `WHERE merchant_id = req.user.merchantId` at the middleware level. `branch_id` is included even for Merchant Admins (who oversee all branches) because the Employee record is always branch-scoped.

**Short-lived access token (15 min) delivery differs by actor type.**
Admin and Merchant tokens are issued into `httpOnly` cookies (web portals, XSS-safe). Client tokens are returned in the response body as `{ accessToken, sessionToken }` — the Client Portal is a mobile app that cannot read `httpOnly` cookies. Mobile stores both values (e.g. secure device storage) and sends the access token as `Authorization: Bearer <token>` on every protected request. Refresh calls `POST /auth/client/refresh` with `{ sessionToken }` in the body. `session_id` cookies are not set for Client sessions. Rejected for Client: httpOnly cookie — a mobile HTTP client cannot read it; rejected: long-lived single token — loses instant revocation when an account is suspended.

**Three separate session tables.**
`admin_sessions`, `merchant_sessions`, and `client_sessions` each carry a proper FK to their respective user table. A single polymorphic sessions table was rejected: financial audit isolation requires per-actor separation, and proper FK constraints cannot be expressed on a polymorphic reference.

**Platform admin accounts are created by existing admins.**
No public registration endpoint exists for `admin_users`. A logged-in Platform Admin can create new admin accounts via `POST /admin/users` (guarded by the admin JWT). Seed-only creation was rejected as an operational burden as the Finsum team grows.

## Authorization: RBAC

_Amends the role/authorization aspects of this ADR (the original assumed a fixed three-role enum enforced by hardcoded route checks). The auth flows, session model, and registration above are unchanged._

**Backend is the source of truth; the matrix is enforced, not cosmetic.**
Every guarded route calls `requirePermission(feature)`. The prior hardcoded role checks (`role === 'merchant_admin'`, etc.) are removed. The frontend hides UI as a convenience only. Rejected: keeping the matrix frontend-only — a crafted request bypassed it entirely, so toggling a permission did not actually restrict the API.

**Roles are custom, global templates — defined only on the admin platform.**
A `roles` table replaces the fixed enum. Each Role belongs to one platform (`merchant` or `admin`). Merchant Roles are global — they apply to every Merchant's Employees, with no `merchant_id` column. Rejected: _per-merchant roles_ (each Merchant gets its own role set) — far more UI and every resolution must carry `merchant_id`, unneeded since Finsum centrally defines the role structure. Rejected: _fixed enum_ — cannot express new roles (e.g. a future "Cashier") without a code change. The existing `agent` / `merchant_admin` are seeded with stable keys as defaults.

**Page/feature-level Features, not resource×action.**
A Feature is a coarse capability guarding a screen/operation group (`view_deals`, `manage_employees`, `manage_payments`), with a `view_*` / `manage_*` split where read-only access is meaningful. The catalog of valid Features is a typed constant in code (one set per platform), giving compile-time-safe guards and a single source of truth; an endpoint exposes it so the Permissions page can render matrix rows. Rejected: _resource×action CRUD_ — dozens of mostly-nonsensical combinations to manage. Rejected: _field/row-level_ — row visibility is already handled by `merchant_id` / `branch_id` / agent-owns-Deal scoping, which is orthogonal to Features.

**Default-deny grant list.**
`role_permissions` is keyed by `role_id` + feature; a row means _granted_, absence means _denied_. A newly created Role starts with zero access. Rejected: the prior _default-allow_ behaviour — a new Role would have full access until explicitly restricted, unsafe once the backend enforces it.

**Permissions resolve from an in-memory cache keyed by Role.**
The JWT carries the Role identifier; the guard resolves Role → `Set<feature>` from an in-memory cache loaded from `role_permissions` and invalidated when an admin edits permissions. No per-request DB hit; edits take effect immediately platform-wide. Rejected: _per-request DB lookup_ (a round-trip on every guarded route) and _baking the feature list into the JWT_ (a 15–30 min stale window on every permission change).

**Immutable Superadmin role on the admin platform.**
The admin platform had no roles. A seeded `superadmin` Role implicitly holds every Feature and bypasses the grant table; it cannot be edited, deleted, or stripped of Features, and at least one Platform Admin must always hold it. The initial seeded admin holds it. Rejected: _no guard_ — one bad edit could brick the admin platform and need DB/engineer recovery. A non-Superadmin holding `manage_roles` may only grant Features they themselves hold and may never view/edit the Superadmin Role or grant `manage_admins` / `manage_roles` — this caps silent self-escalation.

**Single Role per admin; multi-Role per Employee.**
`admin_users` gains a `role_id` FK (exactly one); no admin login picker. Employees keep multiple merchant Roles with the login picker from the original decision above. Rejected: mirroring multi-Role on admins — adds a join table and a picker step for a small, centrally-managed group that rarely needs more than one Role.

**Role assignment is local; Merchant Admins can only mint Agents.**
Platform Admins assign admin Roles to admin users and provision the elevated Merchant accounts (Merchant Admin) via `admin/employees`. A Merchant Admin creating an Employee may assign only the seeded `agent` Role (hardcoded by key) — never `merchant_admin` or any other Role. Rejected: a _merchant-assignable flag_ on Roles and a _role-level hierarchy_ — unnecessary indirection for the single concrete rule ("Merchant Admins create Agents only").

## JWT Claims

| Token type | Claims |
|---|---|
| Admin | `sub` (admin_user id), `roleId`, `type: 'admin'` |
| Merchant | `sub` (merchant_user id), `merchantId`, `branchId`, `role`, `roleId`, `type: 'merchant'` |
| Client | `sub` (user id), `type: 'client'` |

## Auth Endpoints

| Actor | Endpoint | Notes |
|---|---|---|
| Platform Admin | `POST /auth/admin/login` | Email + password |
| Platform Admin | `POST /auth/admin/refresh` | `session_id` cookie → new access token |
| Merchant Employee | `POST /auth/merchant/login` | Phone + password; returns role picker flag if multi-role |
| Merchant Employee | `POST /auth/merchant/refresh` | `session_id` cookie → new access token |
| Client (login) | `POST /auth/client/login/phone` | Phone → OTP sent |
| Client (login) | `POST /auth/client/login/otp` | OTP → `{ accessToken, sessionToken, user }` in body |
| Client (register) | `POST /auth/client/register/phone` | Phone → OTP sent |
| Client (register) | `POST /auth/client/register/otp` | OTP verified → `regToken` in body |
| Client (register) | `POST /auth/client/register/pinfl` | PINFL uniqueness check + MyID session |
| Client (register) | `POST /auth/client/register/complete` | MyID callback → `{ accessToken, sessionToken, user }` in body |
| Client | `POST /auth/client/refresh` | `{ sessionToken }` body → `{ accessToken }` in body |
| Client | `POST /auth/client/logout` | `{ sessionToken }` body → session revoked |

## Schema (auth tables)

```
admin_users       — id, email, password_hash, full_name, role_id (FK roles), created_by, created_at
merchant_users    — id, phone, password_hash, full_name, merchant_id, branch_id, roles[] (role keys), active, created_at
users             — id, phone, pinfl (unique), full_name, myid_verified_at, created_at

admin_sessions    — id, admin_user_id (FK), refresh_token_hash, expires_at, created_at, revoked_at
merchant_sessions — id, merchant_user_id (FK), selected_role, refresh_token_hash, expires_at, created_at, revoked_at
client_sessions   — id, user_id (FK), refresh_token_hash, expires_at, created_at, revoked_at
```

### Schema (RBAC tables)

```
roles             — id, key (stable slug, unique per platform), name, platform ('merchant' | 'admin'),
                    is_superadmin (bool), is_system (bool, seeded/undeletable), created_at
role_permissions  — role_id (FK roles), feature (string)        PK (role_id, feature)   — presence = granted
```

Notes:
- The `feature` catalog is not a table — valid keys are a typed constant in code, one set per platform.
- Superadmin (`is_superadmin = true`) bypasses `role_permissions` and is treated as holding every Feature.
- `merchant_users.roles[]` stores Role **keys** (stable slugs), preserving multi-Role + the login picker; the JWT carries the selected Role's key and `role_id`.
