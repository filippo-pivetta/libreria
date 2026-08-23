"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SignOutButton } from "@/components/layout/sign-out-button";

/**
 * The four nav items (design doc §5). The bar sits on plane 0, not on a
 * card: it isn't content, it's the room — no .plane-1/.plane-2 here. The
 * active item is marked with full-ink text and a rule, never a fill.
 *
 * Labels stay Italian: the product's UI language today, pending the i18n
 * layer (AGENTS.md notes this isn't built yet).
 *
 * ---------------------------------------------------------------------------
 * DUE BARRE, NON UNA RESA ELASTICA (sessione UI, §8: "mobile pari a desktop").
 *
 * Prima era una riga sola, senza `flex-wrap` e senza un solo breakpoint,
 * identica a 320px e a 1440px: quattro etichette maiuscole da 10.5px con
 * `tracking` largo, più il nome utente, più un pulsante. Su un telefono non ci
 * stava, e non si vedeva perché `overflow-x: hidden` sul body la tagliava in
 * silenzio invece di lasciarla scorrere. I bersagli erano alti ~14px.
 *
 * Da 640px in su resta la barra in alto, ora **fissa allo scorrimento** — le
 * due barre contestuali (di un collegato, di un libro) erano già `sticky`, e
 * quella di casa propria no: un'asimmetria che non aveva ragione.
 *
 * Sotto i 640px le stesse quattro voci diventano una barra in fondo, che è
 * dove sta la navigazione di un'app e dove arriva il pollice. Nome utente ed
 * "Esci" escono da lì e vanno in Torre, che è la loro sede naturale.
 *
 * **Senza icone, di proposito.** Una tab bar di solito le ha, ma in tutta
 * l'app non esiste un vocabolario di icone: ci sono due chevron in un
 * selettore d'anno e qualche glifo tipografico. Inventarne quattro qui
 * significherebbe aprire un linguaggio visivo nuovo per un componente solo. Le
 * etichette bastano: sono quattro parole corte, e la voce attiva si legge dal
 * filetto e dall'inchiostro pieno, come in alto.
 *
 * Lo scambio è in CSS (`hidden` / `sm:flex`), non in JavaScript: nessun
 * `matchMedia`, quindi nessun lampeggio della barra sbagliata prima
 * dell'idratazione.
 * ---------------------------------------------------------------------------
 */
const NAV_ITEMS = [
  { href: "/", label: "Libreria" },
  { href: "/annals", label: "Annali" },
  { href: "/readers", label: "Lettori" },
  { href: "/tower", label: "Torre" },
] as const;

function attiva(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/**
 * Il contatore delle richieste ricevute: l'unico elemento in `alert` di tutta
 * l'app (design doc §5). `aria-label` esplicita perché il solo numero, letto
 * ad alta voce dopo "Torre", non dice di cosa è il conteggio.
 */
function Contatore({ n }: { n: number }) {
  return (
    <span
      className="rounded-object bg-alert px-1 py-0.5 font-ui text-[10px] font-semibold text-on-accent normal-case"
      aria-label={`${n} ${n === 1 ? "richiesta ricevuta" : "richieste ricevute"}`}
    >
      {n}
    </span>
  );
}

export function ProtectedNav({
  userName,
  receivedRequestCount,
}: {
  userName: string;
  /**
   * Received-connection-request count (design doc §5): the only element
   * in `alert` in the whole app. Populated by app/(protected)/layout.tsx
   * from GET /collegamenti; stays optional so a failed fetch there just
   * omits the badge instead of blocking the whole layout.
   */
  receivedRequestCount?: number;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* ---------------------------------------------------------------
          DA 640px IN SU — la barra in alto, fissa allo scorrimento.
          --------------------------------------------------------------- */}
      <header className="plane-0 sticky top-0 z-40 hidden border-b border-line sm:block">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-4">
          <nav className="flex items-center gap-6" aria-label="Navigazione principale">
            {NAV_ITEMS.map((item) => {
              const active = attiva(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`t-label relative pb-1 tracking-[0.1em] transition-colors duration-(--dur-micro) ${
                    active
                      ? "text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-ink"
                      : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {item.label}
                  {item.href === "/tower" && !!receivedRequestCount && (
                    <span className="ml-1.5">
                      <Contatore n={receivedRequestCount} />
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

      {/* ---------------------------------------------------------------
          SOTTO I 640px — la barra in fondo.

          `--safe-b` sotto il contenuto e non attorno: la barra arriva fino al
          bordo fisico dello schermo (altrimenti sopra l’indicatore home
          resterebbe una striscia del piano 0 sotto di lei), ma le etichette
          restano sopra l’indicatore.

          `paddingBottom` in linea e non in Tailwind perché è una `env()`
          dentro una `calc()`: passa dai token, non da un valore a occhio.
          --------------------------------------------------------------- */}
      <nav
        aria-label="Navigazione principale"
        className="plane-0 fixed inset-x-0 bottom-0 z-40 flex border-t border-line sm:hidden"
        style={{ paddingBottom: "var(--safe-b)" }}
      >
        {NAV_ITEMS.map((item) => {
          const active = attiva(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 px-1 ${
                active
                  ? "text-ink before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-ink"
                  : "text-ink-soft"
              }`}
              style={{ minHeight: "var(--tab-h)" }}
            >
              <span className="t-label tracking-[0.1em] text-current">{item.label}</span>
              {item.href === "/tower" && !!receivedRequestCount && (
                <Contatore n={receivedRequestCount} />
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
