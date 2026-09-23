"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/**
 * "Riprova" per un errore nato in un Server Component.
 *
 * Il caso da cui viene: la Libreria che non arriva al primo render dopo
 * l'accesso. La frase composta dal catalogo dice "Riprova fra poco", ma
 * non c'era niente da premere — `ErrorState` accetta una `onRetry`, e una
 * funzione non attraversa il confine server/client. Restava il tasto di
 * ricarica del browser, che è l'ammissione che l'app non sa rimettersi in
 * piedi da sola.
 *
 * `router.refresh()` e non `location.reload()`: rifà la richiesta al
 * server per questa sola rotta, **svuotando la Client Cache del
 * segmento** (Next 16, `use-router`). È quest'ultima parte a rendere il
 * comando onesto invece che decorativo: `lib/dati/letture.ts` sta dietro
 * un `"use cache: private"` con `stale: 300`, cioè la risposta — errore
 * compreso — resta buona nella memoria del browser per cinque minuti. Un
 * ricaricamento morbido che non la svuotasse rimostrerebbe lo stesso
 * guasto senza aver chiesto niente a nessuno. Una ricarica intera
 * funzionerebbe (la cache privata non sopravvive al reload) ma butta via
 * anche tutto il resto: il guscio, la sessione già verificata, la
 * posizione nella pagina.
 *
 * `useTransition` perché il ritorno dal server non è istantaneo e un
 * comando che non dà segno di aver sentito il clic invita a premerlo di
 * nuovo — cioè a raddoppiare le richieste proprio mentre il server è in
 * affanno, che è il caso in cui si sta.
 */
export function RiprovaRotta() {
  const t = useTranslations();
  const router = useRouter();
  const [inCorso, avvia] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={inCorso}
      onClick={() => avvia(() => router.refresh())}
    >
      {inCorso ? t("attesa.generica") : "Riprova"}
    </Button>
  );
}
