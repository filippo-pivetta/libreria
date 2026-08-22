"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  cancellaRecensione,
  scriviRecensione,
  type Recensione as RecensioneDato,
  type Visibilita,
} from "@/lib/api/recensioni";
import { getAccessToken } from "@/lib/api/access-token";
import { useToast } from "@/providers/toast-provider";

const DURATA_CONFERMA_MS = 2200;

/**
 * Recensione (design doc §9): un paragrafo Literata sulla pagina destra,
 * sotto le stelle — una per Voce (PRD, entità Recensione), condivisa per
 * default. Stesso pattern blur-salva di `NotaIntenzione`, incluso il
 * significato di "campo svuotato": qui però svuotarlo cancella la
 * recensione (`DELETE`), non la imposta a un valore nullo, perché il
 * testo della recensione non è mai opzionale a schema.
 *
 * Il controllo di visibilità non ha un'affordance specificata dal design
 * doc: si usa qui il minimo coerente con `NotaIntenzione`, un comando
 * testuale sottolineato — punto da rivedere con chi cura il design se ne
 * emerge uno più specifico.
 *
 * Per un collegato: sola lettura, nessuna riga se non condivisa o non
 * scritta ("l'assenza è muta", design doc §15).
 */
export function Recensione({
  voceId,
  recensione,
  isOwner,
}: {
  voceId: string;
  recensione: RecensioneDato | null;
  isOwner: boolean;
}) {
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const [aperta, setAperta] = useState(recensione !== null);
  const [testo, setTesto] = useState(recensione?.testo ?? "");
  const [visibilita, setVisibilita] = useState<Visibilita>(recensione?.visibilita ?? "condiviso");
  const [salvato, setSalvato] = useState(false);

  function invalida() {
    void queryClient.invalidateQueries({ queryKey: ["voce", voceId] });
  }

  const mutazioneScrivi = useMutation({
    mutationFn: async (valori: { testo: string; visibilita: Visibilita }) => {
      const token = await getAccessToken();
      const result = await scriviRecensione(token, voceId, valori.testo, valori.visibilita);
      if (result.status !== "ok") {
        throw new Error(
          result.status === "not_found" ? "Questa voce non esiste più." : result.message,
        );
      }
    },
    onSuccess: () => {
      invalida();
      setSalvato(true);
      setTimeout(() => setSalvato(false), DURATA_CONFERMA_MS);
    },
    onError: (error: unknown) => {
      showError(
        error instanceof Error ? error.message : "Non è stato possibile salvare la recensione.",
      );
      setTesto(recensione?.testo ?? "");
    },
  });

  const mutazioneCancella = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      const result = await cancellaRecensione(token, voceId);
      if (result.status !== "ok" && result.status !== "not_found") {
        throw new Error(result.message);
      }
    },
    onSuccess: () => {
      invalida();
      // Azzerato esplicitamente, non solo implicito nel fatto che
      // svuotarlo è ciò che ha innescato la cancellazione: se il prop
      // `recensione` resta temporaneamente quello vecchio (l'invalidazione
      // è asincrona) e l'Utente riapre il campo prima che arrivi il
      // refetch, un blur senza scrivere nulla non deve poter far
      // ripartire un'altra scrittura.
      setTesto("");
      setAperta(false);
    },
    onError: (error: unknown) => {
      showError(
        error instanceof Error ? error.message : "Non è stato possibile cancellare la recensione.",
      );
      setTesto(recensione?.testo ?? "");
    },
  });

  function salvaSeCambiato() {
    const finale = testo.trim();
    if (finale === "") {
      if (recensione !== null) {
        mutazioneCancella.mutate();
      }
      return;
    }
    if (finale !== recensione?.testo || visibilita !== recensione?.visibilita) {
      mutazioneScrivi.mutate({ testo: finale, visibilita });
    }
  }

  function alternaVisibilita() {
    const nuova: Visibilita = visibilita === "condiviso" ? "privato" : "condiviso";
    setVisibilita(nuova);
    if (testo.trim() !== "") {
      mutazioneScrivi.mutate({ testo: testo.trim(), visibilita: nuova });
    }
  }

  if (!isOwner) {
    if (recensione === null) return null;
    return (
      <div className="mb-5">
        <p className="t-label mb-2">Recensione</p>
        <p className="t-appunto text-ink">{recensione.testo}</p>
      </div>
    );
  }

  if (!aperta) {
    return (
      <button
        type="button"
        onClick={() => setAperta(true)}
        className="t-meta mb-5 self-start underline decoration-line-strong underline-offset-4 hover:decoration-ink"
      >
        Scrivi una recensione
      </button>
    );
  }

  return (
    <div className="mb-5 rounded-card border border-line bg-surface-2 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="t-label">Recensione</p>
        <button
          type="button"
          onClick={alternaVisibilita}
          className="t-meta underline decoration-line-strong underline-offset-4 hover:decoration-ink"
        >
          {visibilita === "condiviso" ? "Condivisa con i collegati" : "Privata, solo tua"}
        </button>
      </div>
      <textarea
        value={testo}
        onChange={(event) => setTesto(event.target.value)}
        onBlur={salvaSeCambiato}
        rows={5}
        placeholder="Cosa ne pensi?"
        className="t-appunto w-full resize-none border-0 bg-transparent text-ink outline-none placeholder:text-ink-soft"
      />
      {salvato && <p className="t-meta mt-2">Salvato.</p>}
    </div>
  );
}
