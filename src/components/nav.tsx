"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV = [
  { href: "/", label: "Dashboard", short: "Home", icon: "🏠" },
  { href: "/orders", label: "Orders", short: "Orders", icon: "🧾" },
  { href: "/customers", label: "People", short: "People", icon: "🧑‍🤝‍🧑" },
  { href: "/batches", label: "Batches", short: "Batches", icon: "🫙" },
  { href: "/reports", label: "Reports", short: "Reports", icon: "📊" },
  { href: "/products", label: "Products", short: "Jars", icon: "🥬" },
];

/** The dashboard only matches exactly; every other tab matches its section. */
function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="ml-auto hidden items-center gap-1 lg:flex">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-2.5 py-2 text-sm font-semibold whitespace-nowrap transition ${
              active
                ? "bg-brand/12 text-brand"
                : "text-fg-muted hover:bg-surface-2 hover:text-fg"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur lg:hidden">
      <div className="flex">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition ${
                active ? "text-brand" : "text-fg-muted active:bg-surface-2"
              }`}
            >
              {active ? (
                <span
                  aria-hidden
                  className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-brand"
                />
              ) : null}
              <span
                aria-hidden
                className={`text-base leading-none transition ${active ? "scale-110" : "grayscale-[35%] opacity-80"}`}
              >
                {item.icon}
              </span>
              {item.short}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
