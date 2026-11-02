import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEMO_USER_ID } from "../src/lib/demo";

const prisma = new PrismaClient();

async function upsertUser(
  email?: string,
  name?: string,
  password?: string,
  options: { id?: string; isDemo?: boolean } = {},
) {
  if (!email || !password) return null;
  const passwordHash = await bcrypt.hash(password, 12);
  const isDemo = options.isDemo ?? false;
  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { name: name ?? email, passwordHash, isDemo },
    create: {
      ...(options.id ? { id: options.id } : {}),
      email: email.toLowerCase(),
      name: name ?? email,
      passwordHash,
      isDemo,
    },
  });
  console.log(`account ready: ${user.email}${isDemo ? " (demo)" : ""}`);
  return user;
}

async function main() {
  const owner = await upsertUser(
    process.env.SEED_OWNER_EMAIL,
    process.env.SEED_OWNER_NAME,
    process.env.SEED_OWNER_PASSWORD,
  );
  const partner = await upsertUser(
    process.env.SEED_PARTNER_EMAIL,
    process.env.SEED_PARTNER_NAME,
    process.env.SEED_PARTNER_PASSWORD,
  );

  // The demo account signs in here but reads and writes its own tables, so it
  // carries a fixed id that exists in both.
  await upsertUser(
    process.env.SEED_DEMO_EMAIL,
    process.env.SEED_DEMO_NAME ?? "Demo",
    process.env.SEED_DEMO_PASSWORD,
    { id: DEMO_USER_ID, isDemo: true },
  );

  if (!owner && !partner) {
    const existing = await prisma.user.count();
    console.log(
      "No SEED_* credentials found in the environment — skipping account setup.\n" +
        `There ${existing === 1 ? "is" : "are"} currently ${existing} account(s) in this database.`,
    );
    if (existing === 0) {
      console.log(
        "Nobody can sign in yet. Set SEED_OWNER_EMAIL, SEED_OWNER_NAME and SEED_OWNER_PASSWORD\n" +
          "(plus the matching SEED_PARTNER_* trio) and deploy again.",
      );
    }
  }

  const count = await prisma.product.count();
  if (count === 0) {
    await prisma.product.createMany({
      data: [
        { name: "Napa cabbage kimchi — 32 oz", unitLabel: "jar", unitPrice: 2500 },
        { name: "Napa cabbage kimchi — 16 oz", unitLabel: "jar", unitPrice: 1500 },
        { name: "Cucumber kimchi (oi sobagi) — 16 oz", unitLabel: "jar", unitPrice: 1600 },
        { name: "Radish kimchi (kkakdugi) — 16 oz", unitLabel: "jar", unitPrice: 1600 },
      ],
    });
    console.log("seeded starter product list");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
