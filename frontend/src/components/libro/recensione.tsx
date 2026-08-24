"use client";

import { useState } from "react";

import { useConfermaEffimera } from "@/lib/hooks/use-conferma-effimera";
import { Messaggio } from "@/components/ui/messaggio";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  cancellaRecensione,
  scriviRecensione,
  type Recensione as RecensioneDato,
  type Visibilita,
} from "@/lib/api/recensioni";
import { getAccessToken } from "@/lib/api/access-token";
import { useToast } from "@/providers/toast-provider";
import { useTranslations } from "next-intl";
import { Invito } from "@/components/ui/invito";
import { PastigliaInterruttore } from "@/components/ui/pastiglia-interruttore";
import { IconaCollegati, IconaLucchetto } from "@/components/ui/icone";

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
  const t = useTranslations();
  const [aperta, setAperta] = useState(recensione !== null);
  const [testo, setTesto] = useState(recensione?.testo ?? "");
  const [visibilita, setVisibilita] = useState<Visibilita>(recensione?.visibilita ?? "condiviso");
  const conferma = useConfermaEffimera();

  function invalida() {
    void queryClient.invalidateQueries({ queryKey: ["voce", voceId] });
  }

  const mutazioneScrivi = useMutation({
    mutationFn: async (valori: { testo: string; visibilita: Visibilita }) => {
      const token = await getAccessToken();
      const result = await scriviRecensione(token, voceId, valori.testo, valori.visibilita);
      if (result.status !== "ok") {
        throw new Error(
          result.status === "not_found" ? t("assenze.voceSparita") : result.message,
        );
      }
    },
    onSuccess: () => {
      invalida();
      conferma.mostra();
    },
    onError: (error: unknown) => {
      showError(
        error instanceof Error ? error.message : t("errori.recensioneNonSalvata"),
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
        error instanceof Error ? error.message : t("errori.recensioneNonCancellata"),
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

  function alternaVisibilita(condiviso: boolean) {
    const nuova: Visibilita = condiviso ? "condiviso" : "privato";
    setVisibilita(nuova);
    if (testo.trim() !== "") {
      mutazioneScrivi.mutate({ testo: testo.trim(), visibilita: nuova });
    }
  }

  if (!isOwner) {
    if (recensione === null) return null;
    return (
      <div>
        <p className="t-section mb-3 font-medium text-ink-soft">La sua recensione</p>
        <div className="rounded-field border border-line bg-surface-2 p-4 sm:px-[1.125rem]">
          <p className="t-appunto text-ink">{recensione.testo}</p>
        </div>
      </div>
    );
  }

  if (!aperta) {
    // Prima: testo sottolineato a corpo 12,5 in `ink-soft`. Per l'atto
    // centrale del prodotto. Vedi components/ui/invito.tsx.
    return <Invito onClick={() => setAperta(true)}>Scrivi una recensione</Invito>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <span className="t-section font-medium text-ink-soft">Recensione</span>
        {/* Prima era un comando testuale sottolineato la cui etichetta era
            anche lo stato ("Condivisa con i collegati" / "Privata, solo
            tua"), quindi da fermo non si sapeva se descrivesse o
            promettesse. Ora è un interruttore premuto, con `aria-pressed`. */}
        <PastigliaInterruttore
          pressed={visibilita === "condiviso"}
          onPressedChange={alternaVisibilita}
          aria-label="Condividi la recensione con i collegati"
        >
          {visibilita === "condiviso" ? (
            <>
              <IconaCollegati />
              Condivisa
            </>
          ) : (
            <>
              <IconaLucchetto />
              Solo tua
            </>
          )}
        </PastigliaInterruttore>
      </div>
      <div className="pannello rounded-field border border-line bg-surface-2 p-4 sm:px-[1.125rem]">
        <textarea
          value={testo}
          onChange={(event) => setTesto(event.target.value)}
          onBlur={salvaSeCambiato}
          rows={5}
          placeholder="Cosa ne pensi?"
          className="t-appunto w-full resize-none border-0 bg-transparent text-ink outline-none placeholder:text-ink-soft"
        />
        <Messaggio tono="conferma" className="mt-2">{conferma.visibile ? "Salvato." : ""}</Messaggio>
      </div>
    </div>
  );
}
