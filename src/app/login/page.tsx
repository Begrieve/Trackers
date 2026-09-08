import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-hover text-3xl shadow-lg">
            🥬
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">Kimchi Ledger</h1>
          <p className="mt-1 text-sm text-fg-muted">Orders, deliveries, and who owes what.</p>
        </div>

        <div className="card p-6">
          <LoginForm next={next} />
        </div>

        <p className="mt-6 text-center text-xs text-fg-subtle">
          Private tracker. Accounts are created by the site owner.
        </p>
      </div>
    </main>
  );
}
