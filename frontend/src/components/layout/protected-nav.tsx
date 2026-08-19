"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SignOutButton } from "@/components/layout/sign-out-button";

/**
 * The four nav items (design doc §5). The bar sits on plane 0, not on a
 * card: it isn't content, it's the room — no .plane-1/.plane-2 here. The
 * active item is marked with full-ink text and a rule underneath, never a
 * fill.
 *
 * Annals, Readers and Tower don't have a domain screen behind them yet
 * (none of those entities exist on the backend yet): the links point to
 * placeholder pages already in the right structure, ready for when the
 * data arrives — see the corresponding routes under app/(protected)/.
 *
 * Labels stay Italian: the product's UI language today, pending the i18n
 * layer (AGENTS.md notes this isn't built yet).
 */
const NAV_ITEMS = [
  { href: "/", label: "Libreria" },
  { href: "/annals", label: "Annali" },
  { href: "/readers", label: "Lettori" },
  { href: "/tower", label: "Torre" },
] as const;

export function ProtectedNav({
  userName,
  receivedRequestCount,
}: {
  userName: string;
  /**
   * Received-connection-request count (design doc §5): the only element
   * in `alert` in the whole app. Not populated yet — the backend has no
   * Connection entity yet (AGENTS.md, app/models is empty) — so it stays
   * optional: no badge until a caller passes a number.
   */
  receivedRequestCount?: number;
}) {
  const pathname = usePathname();

  return (
    <header className="plane-0 border-b border-line">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-4">
        <nav className="flex items-center gap-6">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`t-label relative pb-1 tracking-[0.1em] transition-colors ${
                  active
                    ? "text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-ink"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {item.label}
                {item.href === "/tower" && !!receivedRequestCount && (
                  <span className="ml-1.5 rounded-object bg-alert px-1 py-0.5 font-ui text-[10px] font-semibold text-on-accent normal-case">
                    {receivedRequestCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <span className="font-ui text-sm text-ink-soft">{userName}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
