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

## Batches

**Batches** records what you actually made — jars per product, the date, and notes.
Set against your orders, it answers the question a ledger alone can't:

- **Spare** — made, not delivered, not promised to anyone
- **Short** — promised on open orders beyond what you've made, so you know what to cook

Cancelled orders release their claim on stock.

### Batch codes and tracing a complaint

Every batch gets a short code on the day it's recorded — `B-260907-2` is the second
batch of 7 September 2026. Short enough to write on a jar lid, and it carries the date
on its face.

On any order, each line has a **From batch…** picker. Once set, the batch's page lists
everyone who received jars from it, so a complaint months later traces both ways:
from a person to the cook that made their jar, and from a suspect batch to everyone
else who got one.

Editing a batch never changes its code, so anything already traced to it stays traced.

### Cost and profit

A batch can also record what it cost to make — ingredients, jars, whatever you want
to itemise. From that:

- Within a batch, cost is split **evenly across the jars it produced**. A $50 cook
  yielding 20 jars puts $2.50 behind each. That's arithmetic you can check in your
  head, which matters more than false precision — record sizes as separate batches
  when the difference between a 32 oz and a 16 oz jar is worth accounting for.
- Across batches, a product's cost per jar is the **weighted average of every jar
  ever made**, so a cheaper cook moves the average in proportion to its size, not
  merely because it came later.
- Reports then show **cost of jars sold**, **gross profit**, and **margin**, priced
  from every batch ever recorded — a jar sold today may well have been cooked last
  month.

**Batch spend** (cash out on cooking in the period) is reported separately from
**cost of jars sold** (what the jars you actually sold cost to make). They answer
different questions and rarely match in any given month.

If jars are sold for a product with no batch cost behind it, the report says so and
names the count, rather than quietly reporting those jars as pure profit.

## Fixing mistakes

Nothing is write-once. A wrong entry can be corrected in place rather than deleted and
rebuilt:

- **Payments** — **Edit** changes the amount, method, date, or note; **Remove** deletes
  a payment recorded by mistake (a prepayment that never happened, say).
- **Order items** — **Correct items** changes quantities, drops a line by setting it to
  zero, or adds one that was missed. Lines already on the order keep the price they
  were sold at, so fixing a quantity never silently re-prices an old order at today's
  list price.
- **Batches** — **Edit** rewrites jar counts, costs, dates, and notes. Items and costs
  are replaced inside one transaction, so a failure part-way can't leave a batch
  holding half its old contents.
- Orders, people, and products were already editable.

## Reports

**Reports** covers any date period — this month, last month, last 90 days, this year,
all time, or an explicit from/to — and breaks the period down by product, by person,
and by payment method. **Download CSV** exports the same figures for your records.

One deliberate distinction: *billed* counts orders **placed** in the period, while
*collected* counts payments **received** in it. Money that arrives this month for an
order from two months ago shows up in collected, not billed — which is what makes the
figures usable for actual bookkeeping.

## Themes

Light, dark, or follow the device — the toggle sits in the header, and the choice is
remembered per device. A small inline script applies the saved theme before first
paint, so a dark-theme visitor never gets a white flash on load.

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

No terminal required — the build creates the database tables and both accounts for you.

1. Import this repo at [vercel.com/new](https://vercel.com/new).
2. Create a Postgres database ([Neon](https://neon.tech) and Vercel Postgres both have
   a free tier) and copy its connection string.
3. In the Vercel project's **Settings → Environment Variables**, add all eight:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | the Postgres connection string |
   | `AUTH_SECRET` | a long random string (32+ characters) |
   | `SEED_OWNER_EMAIL` | your email — this is your username |
   | `SEED_OWNER_NAME` | your name |
   | `SEED_OWNER_PASSWORD` | the password you want |
   | `SEED_PARTNER_EMAIL` | her email |
   | `SEED_PARTNER_NAME` | her name |
   | `SEED_PARTNER_PASSWORD` | her password |

4. Deploy. The build runs the migrations, creates the two accounts, and seeds a
   starter product list. Sign in at your Vercel URL.

If the storage integration named the connection string something other than
`DATABASE_URL`, the build finds it anyway — it also accepts `POSTGRES_PRISMA_URL`,
`POSTGRES_URL`, `DATABASE_URL_UNPOOLED`, and `POSTGRES_URL_NON_POOLING`, preferring a
direct (non-pooled) connection for migrations. An empty value counts as unset.

### If the build fails on the database

```
Error validating datasource `db`: You must provide a nonempty URL.
```

That means no usable connection string was found. The build now stops earlier with a
plainer message naming which variables it checked. Either the database was never
attached, or the variable exists with a blank value — attach a Postgres database and
redeploy.

### Changing a password later

Edit `SEED_OWNER_PASSWORD` (or `SEED_PARTNER_PASSWORD`) in Vercel and redeploy. The
seed updates the password for an existing email, so it doubles as a password reset.

Because the seed runs on every deploy, whatever is in those variables is the password
after each deploy. Orders, people, and payments are never touched — only the two
accounts and the starter product list, and the products are only created when the
table is empty.

### Seeding from a terminal instead

If you'd rather not keep passwords in Vercel, leave the `SEED_*` variables unset (the
build skips account setup and says so) and run this once from a machine with Node
installed:

```bash
DATABASE_URL="<production connection string>" \
SEED_OWNER_EMAIL="you@example.com" SEED_OWNER_NAME="You" SEED_OWNER_PASSWORD="…" \
SEED_PARTNER_EMAIL="her@example.com" SEED_PARTNER_NAME="Her" SEED_PARTNER_PASSWORD="…" \
npm run db:seed
```

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

Covers the ledger math (receivables, prepayments, partial payments, overpayment
credit, cancellations, roll-ups), the batch stock maths, the report date ranges and
aggregations, and database-URL resolution.
