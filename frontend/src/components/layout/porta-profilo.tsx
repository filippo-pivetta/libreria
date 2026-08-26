"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { iniziali } from "@/lib/iniziali";

/**
 * La porta del profilo: le proprie iniziali (design doc §5).
 *
 * Il profilo è uscito dalla barra — non si visita ogni giorno come le
 * altre tre voci — e questa è la sua unica via d'accesso. Le iniziali
 * sono il gesto universale per "il mio account", e in quest'app sono già
 * il vocabolario con cui si rappresenta una persona (elenco lettori,
 * barra contestuale di un collegato): non introduce un'icona nuova, che
 * §5 vieterebbe.
 *
 * Non porta il filetto della voce attiva nemmeno quando si è sul profilo:
 * non è una voce di navigazione, è chi sei. Lo stato attivo si dice con
 * il bordo, come per gli altri oggetti del piano 2.
 *
 * `conNome` solo su desktop: nella barra in alto c'è spazio e il nome
 * utente serviva già lì; sopra il titolo di pagina, su telefono, le sole
 * iniziali bastano e non rubano larghezza al titolo.
 */
export function PortaProfilo({
  userName,
  conNome = false,
}: {
  userName: string;
  conNome?: boolean;
}) {
  const pathname = usePathname();
  const attiva = pathname.startsWith("/profilo");

  return (
    <Link
      href="/profilo"
      aria-current={attiva ? "page" : undefined}
      aria-label={`Profilo di ${userName}`}
      // `bersaglio`: le iniziali sono un cerchio di 32px, e sotto i 640px
      // sono l'UNICA porta del profilo (`layout/chrome.tsx`) — in un
      // angolo dello schermo, per giunta, dove si sbaglia mira. L'area
      // sensibile arriva a 44 in entrambe le direzioni senza gonfiare il
      // cerchio, che a 44px diventerebbe un disco.
      className={`bersaglio flex shrink-0 items-center gap-2 rounded-full transition-colors duration-(--dur-micro) ${
        attiva ? "text-ink" : "text-ink-soft hover:text-ink"
      }`}
    >
      {conNome && <span className="font-ui text-sm">{userName}</span>}
      <span
        aria-hidden
        className={`flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 font-display text-xs text-ink-soft ${
          attiva ? "border border-line-strong" : ""
        }`}
      >
        {iniziali(userName)}
      </span>
    </Link>
  );
}
