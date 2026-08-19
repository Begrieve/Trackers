import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function upsertUser(email?: string, name?: string, password?: string) {
  if (!email || !password) return null;
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { name: name ?? email, passwordHash },
    create: { email: email.toLowerCase(), name: name ?? email, passwordHash },
  });
  console.log(`account ready: ${user.email}`);
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

  if (!owner && !partner) {
    console.log(
      "No SEED_* credentials found in the environment — skipping account creation.\n" +
        "Set SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD (and the SEED_PARTNER_* pair) and re-run.",
    );
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
