"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { PortaProfilo } from "@/components/layout/porta-profilo";

/**
 * La navigazione di casa propria (design doc §5).
 *
 * ---------------------------------------------------------------------------
 * TRE VOCI, NON QUATTRO.
 *
 * Erano Libreria, Annali, Lettori, Torre. Le prime tre si aprono ogni
 * giorno; la quarta — collegamenti e impostazioni — si apriva una volta al
 * mese, e tenerla alla pari delle altre mentiva sulla frequenza d'uso.
 * Ora i collegamenti stanno in Lettori, dove stanno le persone, e ciò che
 * resta è il proprio account: ci si arriva dalle proprie iniziali
 * (`PortaProfilo`), che è il gesto che tutti già conoscono e che promette
 * esattamente ciò che trova.
 *
 * Il nome "Profilo" non è inventato qui: è quello che il PRD usa per
 * questa superficie ("Interruttore nel profilo dell'Utente", "una
 * superficie dedicata nel profilo"), mentre riserva "impostazioni" alle
 * azioni sui dati. "Torre" era anche l'unica voce metaforica su una barra
 * di nomi letterali, contro §5: "il rimando letterario sta nell'insegna,
 * non nella segnaletica interna".
 *
 * ---------------------------------------------------------------------------
 * E POI QUATTRO, CON QUADERNI (agosto 2026).
 *
 * Non è il ritorno della Torre. La quarta voce di prima era un contenitore di
 * impostazioni aperto una volta al mese; questa è il posto dove sta ciò che
 * l'Utente ha scritto — insight, recensioni, e i temi che li attraversano —
 * cioè metà della materia dell'app, che fino a ieri viveva in tre pagine
 * senza ingresso (/cerca, /sintesi, /suggerimenti), raggiungibili solo da un
 * <details> chiuso in mezzo ai filtri della Libreria.
 *
 * §22/§23/§24 le tenevano fuori dalla barra con una frase sola — "la
 * navigazione ha quattro voci e restano quattro" — che è un argomento sulla
 * barra usato per decidere una collocazione: dice dove una funzione NON va,
 * non dove va. E l'altra obiezione, "una voce di menu che può essere spenta è
 * una voce sbagliata", vale per una funzione, non per una materia: i tuoi
 * scritti esistono anche a consenso revocato, ed è solo il modo di
 * interrogarli che si spegne — la pagina lo dichiara, invece di sparire.
 *
 * "Quaderni" sta nel registro di "Annali": una parola piana, non una
 * metafora, che nomina la cosa e non il meccanismo che la produce. Una voce
 * chiamata "Assistente" o "Chiedi" sarebbe stata il cassetto di prima con una
 * linguetta più grande.
 *
 * ---------------------------------------------------------------------------
 * DUE BARRE, NON UNA RESA ELASTICA.
 *
 * Da 640px in su la barra sta in cima ed è fissa allo scorrimento. Sotto i
 * 640px le stesse voci diventano una barra in fondo, dove sta la
 * navigazione di un'app e dove arriva il pollice. Lo scambio è in CSS
 * (`hidden` / `sm:flex`), non in JavaScript: nessun `matchMedia`, quindi
 * nessun lampeggio della barra sbagliata prima dell'idratazione.
 *
 * Con tre linguette invece di quattro ciascuna guadagna un terzo di
 * larghezza, e l'etichetta può tornare al maiuscoletto pieno di §4 senza
 * doverne stringere la spaziatura per farcela stare.
 *
 * **Senza icone, di proposito.** In tutta l'app non esiste un vocabolario
 * di icone: due chevron in un selettore d'anno e qualche glifo
 * tipografico. Tre parole corte bastano, e la voce attiva si legge dal
 * filetto e dall'inchiostro pieno.
 * ---------------------------------------------------------------------------
 */
const NAV_ITEMS = [
  { href: "/", label: "Libreria" },
  { href: "/quaderni", label: "Quaderni" },
  { href: "/annals", label: "Annali" },
  { href: "/readers", label: "Lettori" },
] as const;

/**
 * "Lettori" resta accesa anche dentro la libreria o gli annali di un
 * collegato (`/lettori/[id]`, `/lettori/[id]/annali`): da quando la
 * barra globale non sparisce più lì (Chrome, emendamento 25 agosto
 * 2026), quella pagina è raggiunta SOLO passando da Lettori, quindi è
 * la sezione a cui appartiene — non un ramo a sé che lascerebbe la
 * barra senza nessuna voce accesa.
 */
function attiva(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/readers") return pathname.startsWith("/readers") || pathname.startsWith("/lettori/");
  return pathname.startsWith(href);
}

/**
 * Il contatore delle richieste ricevute: l'unico elemento in `alert` di
 * tutta l'app (design doc §5). Sta accanto a Lettori e non più accanto al
 * profilo — prima segnalava una cosa che in quella pagina non si poteva
 * fare, ora sta accanto al posto dove si agisce.
 *
 * `aria-label` esplicita perché il solo numero, letto ad alta voce dopo
 * "Lettori", non dice di cosa è il conteggio.
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
   * Numero di richieste di collegamento ricevute (design doc §5).
   * Popolato da app/(protected)/layout.tsx da GET /collegamenti; resta
   * opzionale così che un fetch fallito lì ometta il contatore invece di
   * bloccare tutto il layout.
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
                  {item.href === "/readers" && !!receivedRequestCount && (
                    <span className="ml-1.5">
                      <Contatore n={receivedRequestCount} />
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          <PortaProfilo userName={userName} conNome />
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
              className={`relative flex flex-1 items-center justify-center gap-1.5 px-1 ${
                active
                  ? "text-ink before:absolute before:inset-x-5 before:top-0 before:h-px before:bg-ink"
                  : "text-ink-soft"
              }`}
              style={{ minHeight: "var(--tab-h)" }}
            >
              <span className="t-label tracking-[0.1em] text-current">{item.label}</span>
              {item.href === "/readers" && !!receivedRequestCount && (
                <Contatore n={receivedRequestCount} />
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
