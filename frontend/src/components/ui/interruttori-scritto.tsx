"use client";

import type { Visibilita } from "@/lib/api/insight";
import { IconaCollegati, IconaCoperto, IconaLucchetto } from "@/components/ui/icone";
import { PastigliaInterruttore } from "@/components/ui/pastiglia-interruttore";

/*
 * I DUE INTERRUTTORI DI UN TESTO PROPRIO: spoiler e visibilità.
 *
 * Erano scritti due volte, alla lettera, in `libro/insight-lista.tsx` e
 * in `quaderni/scrivi-pensiero.tsx` — stessi due controlli, stesse
 * etichette, stesse icone, stesso ordine. Due copie di una scelta che
 * decide che cosa i collegati vedranno: il posto peggiore dove lasciare
 * due sorgenti.
 *
 * ---------------------------------------------------------------------
 * "COPRI LO SPOILER" È DIVENTATO "SPOILER".
 *
 * L'etichetta di un interruttore deve nominare lo STATO, non l'atto:
 * l'interruttore accanto dice già "Condiviso" e "Solo tuo", cioè due
 * nomi, e questo diceva un imperativo. La conseguenza non era solo di
 * registro — "Copri lo spoiler" premuto si legge come "ho appena coperto
 * uno spoiler", che è un fatto, mentre da spento si legge come una
 * promessa; il nome invece funziona in tutti e due gli stati, ed è
 * esattamente quel che `PastigliaInterruttore` è stato costruito per
 * fare (vedi il suo commento).
 *
 * È anche la parola che i Quaderni usano già: la pastiglia di filtro che
 * mostra gli scritti marcati si chiama "Spoiler", una riga sopra. Le due
 * parlavano dello stesso contrassegno con due nomi diversi.
 *
 * E fa entrare la barra su un telefono: "Copri lo spoiler" più
 * "Condiviso" più Annulla più Salva non stanno in 390px, e il risultato
 * era un `flex-wrap` che spezzava il gruppo in un punto deciso dalla
 * lunghezza del testo invece che dal senso.
 */
export function InterruttoriScritto({
  spoiler,
  onSpoiler,
  visibilita,
  onVisibilita,
}: {
  spoiler: boolean;
  onSpoiler: (valore: boolean) => void;
  visibilita: Visibilita;
  onVisibilita: (valore: Visibilita) => void;
}) {
  return (
    <>
      <PastigliaInterruttore
        pressed={spoiler}
        onPressedChange={onSpoiler}
        aria-label="Copri questo testo per i collegati"
      >
        <IconaCoperto />
        Spoiler
      </PastigliaInterruttore>
      <PastigliaInterruttore
        pressed={visibilita === "condiviso"}
        onPressedChange={(condiviso) => onVisibilita(condiviso ? "condiviso" : "privato")}
        aria-label="Condividi questo testo con i collegati"
      >
        {visibilita === "condiviso" ? (
          <>
            <IconaCollegati />
            Condiviso
          </>
        ) : (
          <>
            <IconaLucchetto />
            Solo tuo
          </>
        )}
      </PastigliaInterruttore>
    </>
  );
}
