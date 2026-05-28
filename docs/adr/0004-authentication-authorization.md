# ADR 0004: Authentication & Authorization

**Status:** Accepted

## Decisions

**Three separate auth flows, one per actor type.**
Three distinct tables (`admin_users`, `merchant_users`, `users`) each have their own login endpoint and issue scoped JWTs. A shared auth flow was rejected: the three actor types have different credentials (email+password vs phone+OTP), different session scopes (platform-wide vs merchant-scoped vs client-scoped), and different security requirements. Mixing them would require type-conditional logic throughout every route guard.

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

**Short-lived access token (15–30 min) in `httpOnly` cookie; server-side refresh.**
Access tokens are JWTs stored in `httpOnly` cookies — never in `localStorage`. Refresh tokens are never sent to the client; instead, a `session_id` is stored in a second `httpOnly` cookie. On `/auth/*/refresh`, the server looks up the session by `session_id`, rotates the stored refresh token, and issues a new access token. Rejected: refresh token in a client-readable cookie — server-side storage gives instant revocation when an account is deactivated.

**Three separate session tables.**
`admin_sessions`, `merchant_sessions`, and `client_sessions` each carry a proper FK to their respective user table. A single polymorphic sessions table was rejected: financial audit isolation requires per-actor separation, and proper FK constraints cannot be expressed on a polymorphic reference.

**Platform admin accounts are created by existing admins.**
No public registration endpoint exists for `admin_users`. A logged-in Platform Admin can create new admin accounts via `POST /admin/users` (guarded by the admin JWT). Seed-only creation was rejected as an operational burden as the Finsum team grows.

## JWT Claims

| Token type | Claims |
|---|---|
| Admin | `sub` (admin_user id), `type: 'admin'` |
| Merchant | `sub` (merchant_user id), `merchantId`, `branchId`, `role`, `type: 'merchant'` |
| Client | `sub` (user id), `type: 'client'` |

## Auth Endpoints

| Actor | Endpoint | Notes |
|---|---|---|
| Platform Admin | `POST /auth/admin/login` | Email + password |
| Platform Admin | `POST /auth/admin/refresh` | `session_id` cookie → new access token |
| Merchant Employee | `POST /auth/merchant/login` | Email + password; returns role picker flag if multi-role |
| Merchant Employee | `POST /auth/merchant/refresh` | `session_id` cookie → new access token |
| Client (login) | `POST /auth/client/otp/request` | Phone → OTP sent |
| Client (login) | `POST /auth/client/otp/verify` | OTP → access token |
| Client (register) | `POST /auth/client/register/phone` | Phone → OTP sent |
| Client (register) | `POST /auth/client/register/otp` | OTP verified |
| Client (register) | `POST /auth/client/register/pinfl` | PINFL uniqueness check + MyID session |
| Client (register) | `POST /auth/client/register/complete` | MyID callback → `users` row created |
| Client | `POST /auth/client/refresh` | `session_id` cookie → new access token |

## Schema (auth tables)

```
admin_users       — id, email, password_hash, full_name, created_by, created_at
merchant_users    — id, email, password_hash, full_name, merchant_id, branch_id, roles[], active, created_at
users             — id, phone, pinfl (unique), full_name, myid_verified_at, created_at

admin_sessions    — id, admin_user_id (FK), refresh_token_hash, expires_at, created_at, revoked_at
merchant_sessions — id, merchant_user_id (FK), refresh_token_hash, expires_at, created_at, revoked_at
client_sessions   — id, user_id (FK), refresh_token_hash, expires_at, created_at, revoked_at
```
