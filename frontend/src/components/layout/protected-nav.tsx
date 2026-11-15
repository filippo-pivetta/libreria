import { Suspense } from "react";
import { Link } from "@/components/ui/link";
import { useLocation } from "react-router";

import { ContatoreConDati, PortaConDati, PortaInAttesa } from "@/components/layout/barra-dati";
import { BarraSchede } from "@/components/layout/barra-schede";
import { IconaAnnali, IconaLettori, IconaLibreria, IconaQuaderni } from "@/components/ui/icone";
import type { DatiBarra } from "@/lib/dati/barra";

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
 * nessun lampeggio della barra sbagliata al primo disegno.
 *
 * Con tre linguette invece di quattro ciascuna guadagna un terzo di
 * larghezza, e l'etichetta può tornare al maiuscoletto pieno di §4 senza
 * doverne stringere la spaziatura per farcela stare.
 *
 * **Con le icone, sotto i 640px (novembre 2026).** Prima la barra era di
 * sole parole: «tre parole corte bastano». Bastavano a chi la legge, non al
 * pollice, che riconosce una forma prima di leggere un'etichetta da 10,5px.
 * In alto, col mouse e lo spazio di un desktop, restano le parole.
 * ---------------------------------------------------------------------------
 */
const NAV_ITEMS = [
  { href: "/", label: "Libreria", Icona: IconaLibreria },
  { href: "/quaderni", label: "Quaderni", Icona: IconaQuaderni },
  { href: "/annals", label: "Annali", Icona: IconaAnnali },
  { href: "/readers", label: "Lettori", Icona: IconaLettori },
] as const;

/**
 * **Perché queste quattro portano `prefetch` e i libri no.**
 *
 * Con `partialPrefetching` un `<Link>` nudo precarica solo il guscio
 * della rotta, non i suoi dati: la pagina compare subito ma il contenuto
 * si fa ancora aspettare, e la PRIMA navigazione di una sessione resta
 * lenta. `prefetch` esteso porta con sé anche i dati.
 *
 * Si può fare qui e non altrove perché queste sono un insieme **chiuso e
 * piccolo**, sempre in vista, che chi apre l'app visita quasi certamente:
 * è il caso in cui precaricare è giustificato. Due di loro non costano
 * nemmeno una chiamata (Quaderni e Aggiungi non fanno fetch lato
 * server), e le altre due la pagano una volta per sessione, perché il
 * risultato resta nella memoria del browser (`lib/dati/durata.ts`).
 *
 * Sui dorsi dello scaffale sarebbe invece sbagliato, e infatti lì c'è il
 * precaricamento su intento (`ui/collegamento-intento.tsx`): i libri sono
 * decine o centinaia, e precaricarli tutti significherebbe altrettanti
 * render lato server per aprirne uno — rubando banda proprio alla pagina
 * che si sta guardando.
 */

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

export function ProtectedNav({ dati }: { dati: Promise<DatiBarra> }) {
  const pathname = useLocation().pathname;

  return (
    <>
      {/* ---------------------------------------------------------------
          DA 640px IN SU — la barra in alto, fissa allo scorrimento.
          --------------------------------------------------------------- */}
      <header className="testata-vetro sticky top-0 z-40 hidden border-b border-line sm:block">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-2">
          <nav className="flex items-center gap-6" aria-label="Navigazione principale">
            {NAV_ITEMS.map((item) => {
              const active = attiva(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  aria-current={active ? "page" : undefined}
                  className={`t-label relative py-3 tracking-[0.1em] transition-colors duration-(--dur-micro) ${
                    active
                      ? "text-ink after:absolute after:inset-x-0 after:bottom-2 after:h-px after:bg-ink"
                      : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {item.label}
                  {item.href === "/readers" && (
                    <span className="ml-1.5">
                      <Suspense fallback={null}>
                        <ContatoreConDati promessa={dati} />
                      </Suspense>
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          {/* Il cerchietto tiene il proprio posto mentre le iniziali
              arrivano: uno spazio vuoto e non uno scheletro pulsante,
              così non c'è un grigio in più da guardare né un salto. */}
          <Suspense fallback={<PortaInAttesa />}>
            <PortaConDati promessa={dati} conNome />
          </Suspense>
        </div>
      </header>

      {/* SOTTO I 640px — la capsula in vetro in fondo (`barra-schede.tsx`). */}
      <BarraSchede voci={NAV_ITEMS} attiva={attiva} dati={dati} />
    </>
  );
}
