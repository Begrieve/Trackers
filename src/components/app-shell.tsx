import Link from "next/link";
import { signOut } from "@/auth";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "/", label: "Dashboard", short: "Home", icon: "◆" },
  { href: "/orders", label: "Orders", short: "Orders", icon: "▤" },
  { href: "/customers", label: "People", short: "People", icon: "☺" },
  { href: "/batches", label: "Batches", short: "Batches", icon: "⬢" },
  { href: "/reports", label: "Reports", short: "Reports", icon: "▧" },
  { href: "/products", label: "Products", short: "Jars", icon: "⬤" },
];

export function AppShell({
  user,
  children,
}: {
  user: { name: string };
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex min-w-0 items-center gap-2 font-bold text-fg">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-base">
              🥬
            </span>
            <span className="truncate max-sm:sr-only">Kimchi Ledger</span>
          </Link>

          <nav className="ml-auto hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-2.5 py-2 text-sm font-medium whitespace-nowrap text-fg-muted hover:bg-surface-2 hover:text-fg"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-1">
            <ThemeToggle />
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                title={`Signed in as ${user.name}`}
                className="rounded-lg px-2.5 py-2 text-sm font-medium whitespace-nowrap text-fg-muted hover:bg-surface-2"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 pb-28 lg:pb-16">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur lg:hidden">
        <div className="flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold text-fg-muted active:bg-surface-2"
            >
              <span aria-hidden className="text-base leading-none text-fg-subtle">
                {item.icon}
              </span>
              {item.short}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
