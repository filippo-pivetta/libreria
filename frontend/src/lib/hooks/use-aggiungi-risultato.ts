"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { aggiungiDaCatalogo, type Risultato, type VoceDelRisultato } from "@/lib/api/ricerca";
import { aggiungiVoce } from "@/lib/api/voci";
import { getAccessToken } from "@/lib/api/access-token";
import { useTranslations } from "next-intl";

export type EsitoAggiunta = { chiave: string; libroId: string; voce: VoceDelRisultato };

/**
 * "Aggiungi alla libreria" a partire da un `Risultato` di ricerca (locale
 * o esterno). Estratto da `RicercaLibri` con l'issue #27, quando i
 * suggerimenti di lettura hanno iniziato a fare la stessa cosa da un
 * secondo punto (una riga di suggerimento risolta contro i cataloghi):
 * stessa identica logica non banale — quale endpoint chiamare, come
 * intestare la Voce appena nata — non tre righe simili da lasciare
 * duplicate.
 *
 * Il branch locale/esterno riflette `RigaRisultato` (design doc §13): un
 * risultato già nel catalogo locale riusa `POST /voci` esistente, uno
 * esterno passa da `POST /libri`. Invalida sempre `["voci"]`, perché lo
 * scaffale deve mostrare il libro nuovo; il rattoppo sul posto dei
 * risultati di ricerca resta a carico del chiamante (`onSuccess`), che sa
 * quale lista di risultati sta mostrando.
 */
export function useAggiungiRisultato(opzioni?: {
  onSuccess?: (esito: EsitoAggiunta) => void;
  onError?: (errore: Error, risultato: Risultato) => void;
}) {
  const queryClient = useQueryClient();
  const t = useTranslations();

  return useMutation({
    mutationFn: async (risultato: Risultato): Promise<EsitoAggiunta> => {
      const token = await getAccessToken();

      if (risultato.origine === "locale" || risultato.libroId !== null) {
        const libroId = risultato.origine === "locale" ? risultato.libroId : risultato.libroId!;
        const esito = await aggiungiVoce(token, libroId);
        if (esito.status === "not_found") throw new Error(t("assenze.libroSparito"));
        if (esito.status !== "ok") throw new Error(esito.message);
        return {
          chiave: risultato.chiave,
          libroId,
          voce: {
            id: esito.data.id,
            stato: esito.data.stato,
            voto: esito.data.voto,
            paginaCorrente: null,
            annoUltimaLettura: null,
          },
        };
      }

      const esito = await aggiungiDaCatalogo(token, risultato.volumeId, risultato.volumiAlternativi);
      if (esito.status === "fonte_irraggiungibile") {
        throw new Error("I cataloghi non rispondono. Riprova tra poco.");
      }
      if (esito.status !== "ok") throw new Error(esito.message);
      return {
        chiave: risultato.chiave,
        libroId: esito.libroId,
        voce: {
          id: esito.voceId,
          stato: "da_leggere",
          voto: null,
          paginaCorrente: null,
          annoUltimaLettura: null,
        },
      };
    },
    onSuccess: (esito) => {
      void queryClient.invalidateQueries({ queryKey: ["voci"] });
      opzioni?.onSuccess?.(esito);
    },
    onError: (errore: unknown, risultato) => {
      opzioni?.onError?.(
        errore instanceof Error ? errore : new Error("Il libro non è stato aggiunto. Riprova."),
        risultato,
      );
    },
  });
}
