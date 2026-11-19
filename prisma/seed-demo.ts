import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEMO_USER_ID } from "../src/lib/demo";

/**
 * Fills the demo's own tables with a believable ledger: a few people, orders
 * at every stage, two cooks, and money part-collected. Running it again wipes
 * and rebuilds that data, which is what the in-app reset does — the real
 * ledger is never opened by this file.
 */

const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY);

export async function seedDemo(demoUrl: string, password: string, name = "Demo") {
  const db = new PrismaClient({ datasourceUrl: demoUrl });

  try {
    // Wipe in dependency order; these tables only ever hold demo data.
    await db.payment.deleteMany();
    await db.orderItem.deleteMany();
    await db.order.deleteMany();
    await db.batchCost.deleteMany();
    await db.batchAllocation.deleteMany();
    await db.batchYield.deleteMany();
    await db.batch.deleteMany();
    await db.customer.deleteMany();
    await db.product.deleteMany();
    await db.variety.deleteMany();
    await db.user.deleteMany();

    await db.user.create({
      data: {
        id: DEMO_USER_ID,
        email: "demo@local",
        name,
        passwordHash: await bcrypt.hash(password, 12),
        isDemo: true,
      },
    });

    const [napaVariety, cucumberVariety, radishVariety] = await Promise.all(
      ["Napa cabbage kimchi", "Cucumber kimchi (oi sobagi)", "Radish kimchi (kkakdugi)"].map(
        (name) => db.variety.create({ data: { name } }),
      ),
    );

    const products = await Promise.all(
      [
        { name: "Napa cabbage kimchi — 32 oz", unitPrice: 2500, jarWeightOz: 32, varietyId: napaVariety.id },
        { name: "Napa cabbage kimchi — 16 oz", unitPrice: 1500, jarWeightOz: 16, varietyId: napaVariety.id },
        { name: "Napa cabbage kimchi — 300 mL sample (11 oz)", unitPrice: 0, jarWeightOz: 11, varietyId: napaVariety.id },
        { name: "Cucumber kimchi (oi sobagi) — 16 oz", unitPrice: 1600, jarWeightOz: 16, varietyId: cucumberVariety.id },
        { name: "Radish kimchi (kkakdugi) — 16 oz", unitPrice: 1600, jarWeightOz: 16, varietyId: radishVariety.id },
      ].map((p) => db.product.create({ data: { ...p, unitLabel: "jar" } })),
    );
    const [napa32, napa16, , cucumber, radish] = products;

    const people = await Promise.all(
      [
        { name: "Grace Kim", phone: "(555) 010-4417" },
        { name: "Dae Park", phone: "(555) 010-9902" },
        { name: "Mina Cho", phone: "(555) 010-2238" },
        { name: "Tomas Reyes", phone: "(555) 010-7781" },
        { name: "Yuki Tanaka", phone: null },
      ].map((c) => db.customer.create({ data: c })),
    );
    const [grace, dae, mina, tomas, yuki] = people;

    // An older cook, fully packed and mostly handed out.
    const october = await db.batch.create({
      data: {
        code: "B-261018-1",
        label: "October napa",
        madeOn: ago(15),
        readyOn: ago(12),
        notes: "Salted overnight. Good crunch.",
        createdById: DEMO_USER_ID,
        yields: {
          create: [{ varietyId: napaVariety.id, name: napaVariety.name, weightOz: 38 * 16 }],
        },
        costs: {
          create: [
            { label: "Ingredients", amount: 6200 },
            { label: "Jars & packaging", amount: 1400 },
          ],
        },
      },
    });

    // A recent cook, packed, partly spoken for.
    const november = await db.batch.create({
      data: {
        code: "B-261030-1",
        label: "Cucumber and radish",
        madeOn: ago(3),
        createdById: DEMO_USER_ID,
        yields: {
          create: [
            { varietyId: cucumberVariety.id, name: cucumberVariety.name, weightOz: 12 * 16 },
            { varietyId: radishVariety.id, name: radishVariety.name, weightOz: 8 * 16 },
          ],
        },
        costs: { create: [{ label: "Ingredients", amount: 4100 }] },
      },
    });

    // Delivered and paid in full.
    await db.order.create({
      data: {
        customerId: grace.id,
        createdById: DEMO_USER_ID,
        status: "DELIVERED",
        orderedAt: ago(14),
        deliveredAt: ago(11),
        items: {
          create: [
            { productId: napa32.id, batchId: october.id, name: napa32.name, quantity: 2, unitPrice: 2500, varietyId: napaVariety.id, jarWeightOz: 32 },
          ],
        },
        payments: {
          create: {
            customerId: grace.id,
            amount: 5000,
            method: "CASH",
            paidAt: ago(11),
            recordedById: DEMO_USER_ID,
          },
        },
      },
    });

    // Delivered, still owes — the receivable the dashboard chases.
    await db.order.create({
      data: {
        customerId: dae.id,
        createdById: DEMO_USER_ID,
        status: "DELIVERED",
        orderedAt: ago(13),
        deliveredAt: ago(10),
        items: {
          create: [
            { productId: napa16.id, batchId: october.id, name: napa16.name, quantity: 3, unitPrice: 1500, varietyId: napaVariety.id, jarWeightOz: 16 },
          ],
        },
      },
    });

    // Part-paid and delivered: some cash still at the door.
    await db.order.create({
      data: {
        customerId: mina.id,
        createdById: DEMO_USER_ID,
        status: "DELIVERED",
        orderedAt: ago(9),
        deliveredAt: ago(7),
        items: {
          create: [
            { productId: napa16.id, batchId: october.id, name: napa16.name, quantity: 4, unitPrice: 1500, varietyId: napaVariety.id, jarWeightOz: 16 },
          ],
        },
        payments: {
          create: {
            customerId: mina.id,
            amount: 3000,
            method: "BANK_TRANSFER",
            paidAt: ago(7),
            recordedById: DEMO_USER_ID,
          },
        },
      },
    });

    // Prepaid, not yet delivered — kimchi owed.
    await db.order.create({
      data: {
        customerId: tomas.id,
        createdById: DEMO_USER_ID,
        status: "PENDING",
        orderedAt: ago(4),
        items: {
          create: [
            { productId: cucumber.id, batchId: november.id, name: cucumber.name, quantity: 3, unitPrice: 1600, varietyId: cucumberVariety.id, jarWeightOz: 16 },
          ],
        },
        payments: {
          create: {
            customerId: tomas.id,
            amount: 4800,
            method: "CHEQUE",
            paidAt: ago(4),
            note: "Paid up front",
            recordedById: DEMO_USER_ID,
          },
        },
      },
    });

    // Ordered, nothing set aside yet — this is what makes "short" non-zero.
    await db.order.create({
      data: {
        customerId: yuki.id,
        createdById: DEMO_USER_ID,
        status: "PENDING",
        orderedAt: ago(1),
        items: {
          create: [
            { productId: napa32.id, name: napa32.name, quantity: 4, unitPrice: 2500, varietyId: napaVariety.id, jarWeightOz: 32 },
            { productId: radish.id, name: radish.name, quantity: 2, unitPrice: 1600, varietyId: radishVariety.id, jarWeightOz: 16 },
          ],
        },
      },
    });

    // A promised sample that has not been handed over: it shows on the
    // delivery run beside the orders, and counts in no report until it goes.
    await db.batchAllocation.create({
      data: {
        batchId: november.id,
        productId: cucumber.id,
        name: cucumber.name,
        quantity: 2,
        varietyId: cucumberVariety.id,
        jarWeightOz: 16,
        kind: "DONATED",
        customerId: mina.id,
        note: "Samples to try",
        wentOutOn: null,
      },
    });

    // One already given away, so both states are on show.
    await db.batchAllocation.create({
      data: {
        batchId: october.id,
        productId: napa16.id,
        name: napa16.name,
        quantity: 1,
        varietyId: napaVariety.id,
        jarWeightOz: 16,
        kind: "KEPT",
        note: "Ours for the week",
        wentOutOn: ago(9),
      },
    });

    return { products: products.length, people: people.length };
  } finally {
    await db.$disconnect();
  }
}
