import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getOrders } from "@/lib/queries";
import { buildReport, parseRange } from "@/lib/reports";
import { toDateInputValue } from "@/lib/money";

/** Wraps a field so commas, quotes, and newlines survive a spreadsheet import. */
function cell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const money = (cents: number) => (cents / 100).toFixed(2);

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const range = parseRange(
    url.searchParams.get("from") ?? undefined,
    url.searchParams.get("to") ?? undefined,
    "this-month",
  );

  const [orders, batches] = await Promise.all([
    getOrders(),
    prisma.batch.findMany({ select: { madeOn: true, items: { select: { quantity: true } } } }),
  ]);

  const report = buildReport(orders, batches, range);
  const from = toDateInputValue(range.from);
  const to = toDateInputValue(range.to);

  const rows: (string | number)[][] = [
    ["Kimchi Ledger report"],
    ["From", from],
    ["To", to],
    [],
    ["Summary"],
    ["Orders", report.orderCount],
    ["Jars ordered", report.jars],
    ["Billed", money(report.billed)],
    ["Collected", money(report.collected)],
    ["Still owed", money(report.outstanding)],
    ["Jars made", report.jarsMade],
    ["Batches", report.batchCount],
    [],
    ["By product", "Jars", "Value"],
    ...report.products.map((p) => [p.name, p.quantity, money(p.revenue)]),
    [],
    ["By person", "Orders", "Jars", "Billed", "Paid", "Owed"],
    ...report.people.map((p) => [p.name, p.orders, p.jars, money(p.billed), money(p.paid), money(p.owed)]),
    [],
    ["Payment method", "Payments", "Amount"],
    ...report.methods.map((m) => [m.label, m.count, money(m.amount)]),
  ];

  const csv = rows.map((row) => row.map(cell).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kimchi-report-${from}-to-${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
