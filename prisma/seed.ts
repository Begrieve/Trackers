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
    // Jar sizes belong to a kimchi type; batches are weighed against the type.
    const starters = [
      { variety: "Napa cabbage kimchi", jarWeightOz: 32, unitPrice: 2500 },
      { variety: "Napa cabbage kimchi", jarWeightOz: 16, unitPrice: 1500 },
      { variety: "Napa cabbage kimchi", jarWeightOz: 11, unitPrice: 0 },
      { variety: "Cucumber kimchi (oi sobagi)", jarWeightOz: 16, unitPrice: 1600 },
      { variety: "Radish kimchi (kkakdugi)", jarWeightOz: 16, unitPrice: 1600 },
    ];

    for (const starter of starters) {
      const variety = await prisma.variety.upsert({
        where: { name: starter.variety },
        update: {},
        create: { name: starter.variety },
      });
      await prisma.product.create({
        data: {
          name:
            starter.jarWeightOz === 11
              ? `${starter.variety} — 300 mL sample (11 oz)`
              : `${starter.variety} — ${starter.jarWeightOz} oz`,
          varietyId: variety.id,
          jarWeightOz: starter.jarWeightOz,
          unitLabel: "jar",
          unitPrice: starter.unitPrice,
        },
      });
    }
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
