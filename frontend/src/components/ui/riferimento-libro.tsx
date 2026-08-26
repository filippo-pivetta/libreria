"use client";

import Link from "next/link";

import { IconaLibro } from "@/components/ui/icone";
import { cn } from "@/lib/utils";

/*
 * IL LIBRO DA CUI VIENE UN PENSIERO.
 *
 * Nei Quaderni ogni carta porta in testa il libro a cui lo scritto
 * appartiene, e lo portava così:
 *
 *   t-meta underline decoration-line-strong underline-offset-4 hover:decoration-ink
 *
 * cioè ESATTAMENTE il vestito di "Mostrane un altro", di "Genera di
 * nuovo", di "Nascondi i vicini" — gli otto comandi testuali della
 * stessa pagina. Un rimando e un comando indistinguibili, a due
 * centimetri l'uno dall'altro, sulla stessa carta. Non è un dettaglio
 * estetico: sono due promesse opposte. Uno porta via dalla pagina, e chi
 * lo preme deve saperlo prima; l'altro cambia qualcosa qui e basta.
 *
 * Il rimedio non è dare al link un colore suo — §3 vieta l'accento come
 * testo, e sarebbe comunque la soluzione debole: due sottolineature di
 * tinta diversa restano due sottolineature. È dargli la FORMA di quel
 * che è. Il libro non è un'azione, è la PROVENIENZA del pensiero: un
 * dato, con dentro un rimando. E un dato con un contorno, nell'app, è
 * una pastiglia — la stessa grammatica dei generi sulla scheda (§9,
 * zona 4) e degli stati (§7).
 *
 * ---------------------------------------------------------------------
 * IL TITOLO SI TRONCA, GLI AUTORI SPARISCONO.
 *
 * Prima la riga era «Titolo · Autore, Autore, Autore», sottolineata per
 * intero e senza tetto: su un telefono un titolo lungo con tre autori
 * prendeva tre righe di sottolineatura sopra un pensiero di due. Il
 * titolo identifica il libro; gli autori, in una carta che parla di quel
 * che TU hai scritto, sono la parte che nessuno stava leggendo. Restano
 * nel titolo accessibile, che è il posto dove servono davvero: chi
 * ascolta la pagina non ha il colpo d'occhio con cui distinguere due
 * «Le città invisibili».
 *
 * La troncatura è `max-w`, non un numero di battute: un titolo corto
 * occupa lo spazio che gli serve e nient'altro.
 */
export function RiferimentoLibro({
  voceId,
  titolo,
  autori,
  onClick,
  className,
}: {
  voceId: string;
  titolo: string;
  autori?: string[];
  onClick?: () => void;
  className?: string;
}) {
  const conAutori = autori && autori.length > 0 ? `${titolo} · ${autori.join(", ")}` : titolo;

  return (
    <Link
      href={`/libro/${voceId}`}
      onClick={onClick}
      title={conAutori}
      aria-label={`Vai a ${conAutori}`}
      className={cn(
        "bersaglio inline-flex max-w-full items-center gap-1.5 self-start rounded-full border border-line py-1 pr-3 pl-2.5",
        "font-ui text-xs text-ink-soft transition-colors duration-(--dur-micro) ease-(--ease-rise)",
        "hover:border-line-strong hover:text-ink",
        className,
      )}
    >
      <IconaLibro aria-hidden className="size-3.5 shrink-0 opacity-70" />
      <span className="truncate">{titolo}</span>
    </Link>
  );
}
