# Dev Credentials

## Platform Admin — ops@finsum.uz
URL: http://localhost:5176

| Email | Password |
|---|---|
| ops@finsum.uz | adminpass123 |
| finance@finsum.uz | adminpass123 |

---

## Merchant App — admin@technomart.uz
URL: http://localhost:5174

| Email | Password | Roles |
|---|---|---|
| admin@technomart.uz | password123 | merchant_admin + agent → role picker shown |
| agent@technomart.uz | password123 | agent → direct login |
| branch@technomart.uz | password123 | branch_admin → direct login |

---

## Client Portal — http://localhost:5175
URL: http://localhost:5175

Registration: phone → OTP → PINFL → MyID (mocked)
Login: phone → OTP

OTP code is returned in the API response as `devOtp` in development.

---

## API
URL: http://localhost:3000

| Endpoint prefix | Actor |
|---|---|
| /auth/admin | Platform Admin |
| /auth/merchant | Merchant Employee |
| /auth/client | Client |
