# JoTalent

A marketplace that connects clients anywhere in the world with a limited,
vetted pool of Jordanian tech freelancers. Clients never post jobs: they pick a
specialization, see qualified freelancers in a fair order, agree terms in chat,
and pay the platform, which holds the money until the work is approved or an
expert decides a dispute.

"JoTalent" is a working name. Change it in one place: `NEXT_PUBLIC_APP_NAME`.

## Run it locally

Requires Node.js 24.7 or newer (password hashing uses its built-in Argon2). No Docker and no external accounts are needed.

```bash
npm install
cp .env.example .env        # then set AUTH_SECRET and the two SEED_*_PASSWORD values
npm run db:dev              # starts a local PostgreSQL (Prisma's embedded server)
npm run db:deploy           # creates the tables
npm run db:seed             # specializations, skills, settings, first admin
npm run db:seed:demo        # optional: demo clients, freelancers and deals
npm run dev                 # http://localhost:3000
```

Sign in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, or with a demo account
(`emma@jotalent.test` is a client, `lina.haddad@jotalent.test` a freelancer,
`expert@jotalent.test` an expert) and `SEED_DEMO_PASSWORD`.

Until email and SMS providers are configured, verification codes and
notification emails are printed in the terminal running `npm run dev`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Develop, build, serve the production build |
| `npm run typecheck` / `lint` / `format` | Static checks and formatting |
| `npm test` | Unit tests: fairness, waiting list, money math, message screening, translations |
| `npm run test:integration` | Service-layer tests against a throwaway database it creates and removes |
| `npm run db:dev` / `db:stop` | Start / stop the embedded local database |
| `npm run db:migrate` | Create and apply a migration after editing `prisma/schema.prisma` |
| `npm run db:deploy` | Apply existing migrations (use this in production) |
| `npm run db:seed` / `db:seed:demo` | Reference data and first admin / demo data |
| `npm run db:passwords` | After editing `SEED_ADMIN_PASSWORD` or `SEED_DEMO_PASSWORD` in `.env`, apply them to the local accounts |
| `npm run db:studio` | Browse the database |

## How the product rules map to code

| Rule | Where |
| --- | --- |
| Limited seats, waiting list, priority for returning freelancers | `src/server/services/admission.ts`, `src/domain/waitlist.ts` |
| Fair, non-rating-based listing order | `src/domain/fairness.ts`, `src/server/services/matching.ts` |
| Chat stays on-platform; contact details are masked and flagged | `src/domain/moderation.ts`, `src/server/services/conversations.ts` |
| Offer → contract → payment held → delivery → release | `src/server/services/deals.ts` |
| Fee and split arithmetic (integer cents, nothing lost to rounding) | `src/domain/money.ts` |
| Disputes decided by an assigned expert | `src/server/services/disputes.ts` |
| Admin: review, certificates, users, payouts, settings | `src/server/services/admin.ts` |
| Admin chat monitoring: read any conversation, read-only, every access audited | `src/server/services/oversight.ts`, `/admin/monitoring/chats` |

Every state change is a guarded update (`... WHERE status = <expected>`), so a
double click or a retried webhook cannot apply a step twice. The database
itself rejects impossible money states through CHECK constraints (see the end
of the migration in `prisma/migrations`).

## Project structure

```
messages/            UI text: en.json is the source of truth, ar.json mirrors it
prisma/              schema, migrations, seeds
src/app/[locale]/    (marketing) public pages · (auth) sign-in/up · (dashboard) signed-in area
src/app/api/         health, chat polling, uploads, private file downloads, Stripe webhook
src/components/      layout/ (navbar, sidebar), dashboard/, cards, UI building blocks, form helpers
src/domain/          pure business rules, unit-tested, no I/O
src/server/          auth, services (all data access), Server Actions, integrations
tests/integration/   end-to-end tests of the service layer
```

Pages and Server Actions never query the database directly; they call a
service, and every service function checks who is asking.

## Security model

Access is checked three times, and each check stands on its own:

1. **Proxy** (`src/proxy.ts`, rules in `src/domain/access.ts`). Runs before any
   page. Everything is private unless listed as public; a private page needs a
   session cookie this server signed, and `/admin` needs the admin role. It
   checks the signature only, no database, so it is cheap and never the last
   word.
2. **Pages** (`src/server/auth/guards.ts`). Every page calls `requireUser` or
   `requireRole`, which read the session from the database on each request.
3. **Actions and data** (`src/server/actions/run.ts`, `src/server/services/`).
   Every Server Action starts with a wrapper that authenticates the caller
   before reading the input; `guards.test.ts` fails if one does not. Services
   then check that the record belongs to the caller.

Sign-in: passwords are Argon2id hashes (`src/server/auth/password.ts`); five
failed attempts block an address for 15 minutes and ten pause an account
(`src/server/auth/login-throttle.ts`); the session cookie is `HttpOnly`,
`Secure`, `SameSite=Strict` and signed (`src/server/auth/session-cookie.ts`).

SQL: all queries go through Prisma. The few raw statements are tagged
`$queryRaw` templates, which bind every value as a parameter; ESLint rejects
`$queryRawUnsafe`, `$executeRawUnsafe` and `Prisma.raw`.

## Going to production

| Need | Set | Notes |
| --- | --- | --- |
| Database | `DATABASE_URL`, remove `DATABASE_POOL_MAX` and `SHADOW_DATABASE_URL` | Any PostgreSQL 15+. Run `npm run db:deploy` on each release. |
| Email | `RESEND_API_KEY`, `EMAIL_FROM` | [resend.com](https://resend.com); verify your sending domain. |
| SMS | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | [twilio.com](https://www.twilio.com); the sender must be able to reach Jordan. |
| Payments | `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Point a webhook for `checkout.session.completed` at `/api/webhooks/stripe`. |
| Files | `STORAGE_DIR` on a persistent disk | To use S3/R2 instead, reimplement the three functions in `src/server/integrations/storage.ts`. |
| Site | `NEXT_PUBLIC_APP_URL`, `AUTH_SECRET` | Serve over HTTPS only: the session cookie is `Secure` and browsers drop it on plain HTTP. Changing `AUTH_SECRET` signs everyone out. |
| Proxies | `TRUSTED_PROXY_HOPS` | How many of your own proxies are in front of the app (default 1). Sign-in lockouts are per visitor address, so a wrong value either locks everyone out together or lets visitors fake their address. |

The app refuses to send codes to the console or accept mock payments in a
production build unless `ALLOW_DEV_SERVICES=true` (for staging).

Paying freelancers is deliberately manual: a release creates a payout record,
and an admin marks it paid with the transfer reference (Admin → Payments).
Stripe cannot pay out to Jordanian bank accounts directly, so the transfer
happens through your bank or CliQ.

## Known limits

- **Voice and video calls** are not built. They need a media provider
  (LiveKit, Daily, Twilio Video); the camera/microphone permission policy
  already allows our own origin.
- **The Stripe adapter is untested against a live account.** It is written
  against Stripe's documented REST API; test it in Stripe test mode first.
- **Terms and privacy pages are placeholders** and say so on the page.
- **The embedded dev database serves one client at a time.** That is why `.env`
  sets `DATABASE_POOL_MAX=1`, and why opening a second client (Prisma Studio, a
  SQL tool) while the app is running can drop the app's connection for a moment.
  For heavier local work use `docker compose up -d` and the URL in `.env.example`.
- **`next-intl`'s config plugin is not used** (see the comment in
  `next.config.ts`): it loads `@swc/core`, whose native binary fails on some
  Windows machines. The alias it would set is configured directly instead.
- Chat updates by polling every four seconds, not over a socket.
