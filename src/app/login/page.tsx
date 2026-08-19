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
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-700 text-2xl">
            🥬
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Kimchi Ledger</h1>
          <p className="mt-1 text-sm text-stone-500">Orders, deliveries, and who owes what.</p>
        </div>

        <div className="card p-6">
          <LoginForm next={next} />
        </div>

        <p className="mt-6 text-center text-xs text-stone-400">
          Private tracker. Accounts are created by the site owner.
        </p>
      </div>
    </main>
  );
}
