# Kimchi Ledger

A private, password-protected tracker for a home kimchi distribution: who ordered,
who paid, who still owes you, who prepaid and is owed product, and how much cash
you should have in hand once everything is delivered.

Built to be used from a phone. Two accounts (you and your wife) share one ledger.

## What it answers

The dashboard is built around five questions:

| Question | Where it shows up |
| --- | --- |
| Who ordered? | **Orders** — every order, filterable |
| Who paid? | **Settled** filter, and the green "paid" state on each order |
| Who ordered but hasn't paid? | **Delivered, unpaid** — your receivables |
| Who prepaid and is owed kimchi? | **Prepaid — you owe kimchi**, with jars still to deliver |
| How much cash will I collect on delivery? | **Owed on delivery**, plus **Cash to collect** for everything owed |

An order can be partly prepaid: the paid portion counts as product you owe, and the
remainder counts as cash to collect at delivery. Overpayments become customer credit
rather than silently disappearing.

All money is stored in integer cents, so no rounding drift.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS 4
- PostgreSQL via Prisma
- Auth.js (NextAuth v5) with email + password, bcrypt-hashed

## Running locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and fill it in:

   ```bash
   cp .env.example .env
   ```

   - `DATABASE_URL` — any Postgres database
   - `AUTH_SECRET` — generate one with `openssl rand -base64 32`
   - `SEED_*` — the two accounts you want created

3. Create the schema and your accounts:

   ```bash
   npx prisma migrate deploy
   npm run db:seed
   ```

4. Start it:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000 and sign in.

## Deploying to Vercel

1. Push this repo to GitHub and import it at [vercel.com/new](https://vercel.com/new).
2. Create a Postgres database (Vercel Postgres or [Neon](https://neon.tech) both work
   on a free tier) and copy its connection string.
3. In the Vercel project's **Settings → Environment Variables**, add:

   - `DATABASE_URL` — the connection string
   - `AUTH_SECRET` — output of `openssl rand -base64 32`

4. Deploy. The build runs `prisma migrate deploy`, so the schema is created for you.
5. Create the two accounts once, from your own machine, pointed at the production
   database:

   ```bash
   DATABASE_URL="<production connection string>" \
   SEED_OWNER_EMAIL="you@example.com" SEED_OWNER_NAME="You" SEED_OWNER_PASSWORD="…" \
   SEED_PARTNER_EMAIL="her@example.com" SEED_PARTNER_NAME="Her" SEED_PARTNER_PASSWORD="…" \
   npm run db:seed
   ```

Re-running the seed updates the password for an existing email, so it doubles as a
password reset.

## Security notes

- Every page and every write goes through an authenticated session; there is no
  public route other than the login page.
- Sessions are signed JWTs in an httpOnly cookie, valid for 30 days.
- Passwords are bcrypt hashes (cost 12). A wrong email and a wrong password take the
  same time to reject, so the login page doesn't reveal which addresses exist.
- Pages are marked `noindex`, and there is no sign-up route — accounts only exist if
  you seed them.
- Keep `AUTH_SECRET` and `DATABASE_URL` out of git; `.env*` is already ignored.

## Tests

```bash
npm test
```

Covers the ledger math: receivables, prepayments, partial payments, overpayment
credit, cancellations, and the dashboard roll-ups.
