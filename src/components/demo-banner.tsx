"use client";

import { useState, useTransition } from "react";
import { resetDemo } from "@/actions/demo";

/**
 * A standing reminder that this is the demo, with a way back to a clean slate.
 * Shown only to the demo account.
 */
export function DemoBanner() {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="border-b border-info-line bg-info-soft">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
        <p className="min-w-0 flex-1 text-sm text-info-fg">
          <span className="font-bold">Demo</span> — sample data in its own database. Change
          anything you like; the real ledger isn&apos;t touched.
        </p>

        {confirming ? (
          <span className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(async () => { await resetDemo(); setConfirming(false); })}
              className="rounded-lg bg-info px-3 py-1.5 text-xs font-bold text-surface disabled:opacity-60"
            >
              {pending ? "Resetting…" : "Yes, reset"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="rounded-lg px-2 py-1.5 text-xs font-semibold text-info-fg"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold text-info-fg underline"
          >
            Reset demo data
          </button>
        )}
      </div>
    </div>
  );
}
