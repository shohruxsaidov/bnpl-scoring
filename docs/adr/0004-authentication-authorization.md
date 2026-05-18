# ADR 0004: Authentication & Authorization

**Status:** Accepted

## Decisions

**Three separate auth endpoints with scoped JWTs.** Authentication is split by user type, each issuing a JWT scoped to its audience. The agent/admin login identifier is a generic `login` string — not constrained to phone or email — so Tenants can choose their own credential format. Only the Client OTP flow uses `phone` explicitly, because OTP delivery requires a verified phone number.

| Endpoint | Users | Credentials | JWT payload |
|---|---|---|---|
| `/api/auth/login` | Sales Agents, Merchant Admins | `login` string + password | `{ user_id, tenant_id, role }` |
| `/api/platform/auth/login` | Platform Admins | Password | `{ user_id, role: "platform_admin" }` |
| `/api/client/auth/otp` | Clients | Phone + OTP | `{ client_id }` |

A single shared login endpoint rejected — Platform Admins must never receive a `tenant_id` in their token, and Clients authenticate via OTP rather than password. Separate endpoints make trust boundaries explicit and auditable at the route level.

**Client portal authenticates via phone number + OTP.** Clients log in using their registered phone number and an SMS OTP. MyID login considered (Clients already use MyID during signing) but rejected — MyID adds a redirect flow and requires the Client to have the app or credentials ready. Phone OTP matches the Client's existing experience (they already receive OTPs during the New Deal Wizard) and reuses the SMS provider already integrated.

**Single-role session with login-time role picker.** An Employee can hold multiple Roles (Agent, Merchant Admin), but a session operates under exactly one Role at a time. When an Employee with multiple Roles logs in, a role picker is shown after credentials are verified; single-Role Employees skip it and land directly on the dashboard.

Multi-role sessions with merged permissions rejected — it collapses the access boundary between Agent and Merchant Admin into a blended context, making it unclear which "hat" the employee is wearing and complicating per-Role audit logging. Session Role is fixed until logout; switching Role requires re-login. The auth store holds Employee identity and active session Role as separate concerns: `resolveRoles()` identifies the employee, `confirmRole()` commits the session.
