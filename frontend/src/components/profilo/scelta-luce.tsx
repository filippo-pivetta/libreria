"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { type PreferenzaLuce } from "@/lib/light";
import { impostaLuce } from "@/components/profilo/azione-luce";

const OPZIONI: { valore: PreferenzaLuce; etichetta: string }[] = [
  { valore: "ora", etichetta: "Segui l’ora" },
  { valore: "giorno", etichetta: "Giorno" },
  { valore: "notte", etichetta: "Notte" },
];

/**
 * La luce della stanza (design doc §3, emendata nella sessione UI).
 *
 * Il documento diceva "non c'è interruttore, non c'è scelta, la parola notte
 * non compare nelle impostazioni", e nominava il costo di quella scelta:
 * "chi ha una sensibilità alla luce non può forzare la stanza scura di
 * giorno". Il costo era accettato ma non mitigato — `prefers-color-scheme`
 * non veniva letto, e nemmeno `prefers-contrast`, che pure §3 indicava come
 * l'unico comando esterno onorato.
 *
 * Ora la scelta esiste, e "Segui l'ora" resta il valore predefinito: la stanza
 * che si scurisce da sola non è stata sostituita, è diventata una delle tre
 * opzioni, quella che nessuno deve scegliere per averla. Due collegati che non
 * toccano nulla continuano a vedere la stessa stanza alla stessa ora.
 *
 * **Ottimistico come ogni altro comando dell'app.** Il gruppo si muove subito,
 * poi `router.refresh()` fa ricalcolare al server la palette e il
 * `theme-color`. Se la scrittura non riesce, torna al valore precedente con
 * l'errore in testo — mai un riquadro rosso (§19).
 *
 * Un gruppo di radio e non tre pulsanti: sono tre valori mutuamente esclusivi
 * di una stessa proprietà, e le frecce della tastiera devono scorrerli.
 */
export function SceltaLuce({ iniziale }: { iniziale: PreferenzaLuce }) {
  const router = useRouter();
  const [scelta, setScelta] = useState<PreferenzaLuce>(iniziale);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, avvia] = useTransition();

  function cambia(valore: PreferenzaLuce) {
    const precedente = scelta;
    setScelta(valore);
    setErrore(null);
    avvia(async () => {
      try {
        await impostaLuce(valore);
        router.refresh();
      } catch {
        setScelta(precedente);
        setErrore("La preferenza non è stata salvata. Riprova.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="radiogroup"
        aria-label="Luce della stanza"
        className="flex flex-wrap gap-1"
      >
        {OPZIONI.map(({ valore, etichetta }) => {
          const attiva = scelta === valore;
          return (
            <button
              key={valore}
              type="button"
              role="radio"
              aria-checked={attiva}
              disabled={inCorso}
              onClick={() => cambia(valore)}
              className={`rounded-full border px-3 py-1 font-ui text-xs transition-colors duration-(--dur-micro) disabled:opacity-60 ${
                attiva
                  ? "border-transparent bg-ink/9 font-medium text-ink"
                  : "border-line text-ink-soft hover:border-line-strong hover:text-ink"
              }`}
            >
              {etichetta}
            </button>
          );
        })}
      </div>
      {errore && <p className="t-meta">{errore}</p>}
    </div>
  );
}
