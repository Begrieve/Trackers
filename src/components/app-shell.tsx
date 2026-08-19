import Link from "next/link";
import { signOut } from "@/auth";

const NAV = [
  { href: "/", label: "Dashboard", short: "Home", icon: "◆" },
  { href: "/orders", label: "Orders", short: "Orders", icon: "▤" },
  { href: "/customers", label: "People", short: "People", icon: "☺" },
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
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex min-w-0 items-center gap-2 font-bold text-stone-900">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-700 text-base">
              🥬
            </span>
            <span className="truncate">Kimchi Ledger</span>
          </Link>

          <nav className="ml-auto hidden items-center gap-1 sm:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <form
            className="ml-auto shrink-0 sm:ml-1"
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              title={`Signed in as ${user.name}`}
              className="rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap text-stone-500 hover:bg-stone-100"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 pb-28 sm:pb-16">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 backdrop-blur sm:hidden">
        <div className="flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-semibold text-stone-500 active:bg-stone-100"
            >
              <span aria-hidden className="text-base leading-none text-stone-400">
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
