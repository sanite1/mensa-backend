# mensa-backend

API server for Mensa Period Products — Nigerian D2C ecommerce for reusable period products. Powers the customer storefront (`mensaproducts.com`), the admin dashboard (`admin.mensaproducts.com`), and the partner programme.

## Stack

- **Node + Express 4** on TypeScript
- **MongoDB** via Mongoose 8
- **Joi** for request validation
- **JWT** auth — 15min access tokens, 30d refresh tokens (httpOnly cookie, rotated on each refresh)
- **Paystack** for payments (Inline modal + webhook reconciliation)
- **Sendbox** for nationwide shipping; in-house rider for FCT + Lagos
- **Cloudinary** for product / content images
- **Nodemailer + Handlebars** for transactional email
- **Winston** for structured logging with daily rotation
- **bcrypt** (cost 12) for password hashing

## Layout

```
src/
  routes/           thin request mounting
  controllers/      parse req/res, call services
  services/         all business logic, no req/res
  models/           Mongoose schemas
  interfaces/       TypeScript shapes shared across layers
  validations/      Joi schemas + the validate() middleware
  middlewares/      auth, role, rate-limit, error handler
  helpers/          pure utilities (sku, orderNumber, sendResponse)
  config/           env validation, db, logger
  scripts/          seed scripts (run via npm run seed:*)
  services/external/  third-party SDK wrappers (paystack, sendbox, cloudinary)
  services/nodemailer/templates/  handlebars email templates + _partials/layout
```

External SDKs only live in `services/external/`. Controllers are thin. Services own the logic and never touch req/res.

## Domains

| Domain | Routes | Notes |
|---|---|---|
| Auth | `/api/v1/auth` | register, login, refresh, logout, forgot/reset, /me. JWT + refresh in httpOnly cookie. |
| Products | `/api/v1/products`, `/api/v1/admin/products` | Public list + slug lookup; admin CRUD + Cloudinary image upload. |
| Cart | client-side only | Zustand store on the frontend; no server cart for guests. Logged-in carts to be added. |
| Checkout / Orders | `/api/v1/checkout`, `/api/v1/orders`, `/api/v1/admin/orders` | Shipping rates → initialize (atomic stock reserve) → Paystack inline → webhook reconciles → fulfilment lifecycle (admin). Public track endpoint with email-as-PIN. |
| Discounts | `/api/v1/admin/discounts` + `/api/v1/checkout/apply-discount` | Admin CRUD. Reservation-based redemption tracking (race-safe). |
| Content (Journal + Education) | `/api/v1/content`, `/api/v1/admin/content` | Public list + slug. Admin CMS (kind, category, markdown body, status). |
| Newsletter | `/api/v1/newsletter`, `/api/v1/admin/newsletter` | Subscribe + token unsubscribe, admin list + delete. |
| Partnerships (orgs) | `/api/v1/admin/partnerships/*` | B2BOrg application + admin verify. |
| Partner programme (individuals) | `/api/v1/partners/*`, `/api/v1/admin/partnerships/individuals/*` | Apply → admin approve (emails onboarding link) → set password + bank → activate → earn commission on referred orders → request payout → admin marks paid. |
| Contact | `/api/v1/contact` | Public form → support inbox via nodemailer with `replyTo` set to the visitor. |
| Webhooks | `/api/v1/webhooks/paystack` | HMAC-SHA512 verified against raw body, idempotent on reference. |

### Order lifecycle

```
pending → paid → processing → shipped → delivered
                          └→ cancelled (refund flow separate)
```

Stock decrement is atomic at `initializeCheckoutService`; restored if init fails or the webhook flags `charge.failed`. Commission for partner referrals accrues `pending` on paid, flips to `available` on delivered, and reverses (clawing back from `availableBalanceKobo`) on cancel/refund.

## Environment

All amounts in MongoDB are **kobo** (integer, 100 kobo = 1 NGN).

### Required to boot

```
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb+srv://...
JWT_SECRET=<32+ random bytes>
JWT_REFRESH_SECRET=<32+ random bytes>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=hi@mensaproducts.com
SMTP_PASSWORD=<app password>
SMTP_FROM="Mensa <hi@mensaproducts.com>"
FRONTEND_PLATFORM_URL=http://localhost:3000
FRONTEND_ADMIN_URL=http://localhost:3002
```

### Feature-gated (soft-warn at boot, hard-error only when called)

```
# Paystack — required for checkout
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_PUBLIC_KEY=pk_test_...

# Sendbox — required for nationwide shipping rates
SENDBOX_API_KEY=...

# Cloudinary — required for product / content image upload
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Optional — destination for contact-form messages. Falls back to SMTP_FROM.
SUPPORT_EMAIL=support@mensaproducts.com
```

The seed for the first admin user reads:

```
SEED_ADMIN_EMAIL=admin@mensaproducts.com
SEED_ADMIN_PASSWORD=<strong password>
SEED_ADMIN_NAME=Admin
```

## Scripts

```
npm run dev            # ts-node-dev with respawn
npm run build          # tsc → dist/
npm start              # node dist/index.js
npm run type-check     # tsc --noEmit
npm run lint           # eslint
npm run test           # vitest

npm run seed:admin     # one-shot: create the first admin from env
npm run seed:products  # idempotent upsert of the 8 launch SKUs
npm run seed:journal   # idempotent upsert of the starter journal + education posts
```

Seed scripts read `MONGO_URI` from `.env` and are safe to re-run — they upsert by slug.

## Conventions

- **Response envelope**: every success returns `{ statusCode, message, data }`. Paginated lists add `pagination: { page, pageSize, total, totalPages }`. Errors return `{ statusCode, message, details? }` via `ApiError`.
- **Money is kobo** end-to-end. Helpers `koboToNaira` / `nairaToKobo` for display conversion only.
- **No commits without explicit permission** — assistant rule the team enforces. Hooks (lint, test) must pass; never `--no-verify`.
- **`ts-node` scripts** load `dotenv/config` themselves; running them outside the dev server still picks up `.env`.

## Deployment

Hosting target is Render or Railway (final pick pending). Two env vars must change in production:

- `FRONTEND_PLATFORM_URL` and `FRONTEND_ADMIN_URL` — used by CORS middleware and by URLs minted in transactional emails.
- Paystack keys swapped to `sk_live_*` / `pk_live_*`.

The webhook endpoint is mounted outside CORS (server-to-server). Paystack should be configured to POST to both `/api/v1/webhooks/paystack` and the legacy alias `/api/payment/webhook/paystack` — both are honoured.

## Known gaps

- B2B beyond org verification (bulk pricing tiers, quote requests, invoicing) is deferred.
- CSV import for historical orders is not built.
- Live FX feed for the frontend currency picker — currently static rates baked into the frontend.
- Rider model: separate `Rider` model vs flag on `User` is undecided.
