import Link from "next/link";
import { signOut } from "@/auth";
import { ThemeToggle } from "./theme-toggle";
import { BottomNav, TopNav } from "./nav";

export function AppShell({
  user,
  children,
}: {
  user: { name: string };
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex shrink-0 items-center gap-2 font-bold text-fg">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-hover text-base shadow-sm">
              🥬
            </span>
            <span className="sr-only">Kimchi Ledger</span>
          </Link>

          <TopNav />

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
                className="rounded-lg px-2.5 py-2 text-sm font-medium whitespace-nowrap text-fg-muted transition hover:bg-surface-2 hover:text-fg"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 pb-28 lg:pb-16">{children}</main>

      <BottomNav />
    </div>
  );
}
