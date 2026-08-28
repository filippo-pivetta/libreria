"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { cancellaLettura } from "@/lib/api/letture";
import { getAccessToken } from "@/lib/api/access-token";
import type { Lettura } from "@/lib/api/voci";
import { periodoLettura } from "@/lib/formato";
import { useToast } from "@/providers/toast-provider";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Menu, MenuContenuto, MenuTrigger, MenuVoce } from "@/components/ui/menu";
import { IconaAltro } from "@/components/ui/icone";
import { ErroreApp, assenza, erroreDi } from "@/lib/api/errore";
import { useMessaggioErrore } from "@/lib/messaggi-errore";

const ETICHETTA_ESITO: Record<string, string> = {
  conclusa: "conclusa",
  abbandonata: "abbandonata",
};

/**
 * Storico delle Letture (design doc §9: "in un pannello che si apre").
 * Sui libri con una Lettura sola ancora aperta, la maggioranza, non
 * compare nulla — è già raccontata dal pannello sopra. Ma una singola
 * Lettura CHIUSA non è raccontata da nessuna altra parte: nasconderla
 * qui la renderebbe invisibile e irraggiungibile (il bug osservato
 * cancellando una Lettura da uno storico di due: quella rimasta,
 * essendo sola, spariva anche lei — nel database restava intatta, un
 * solo DELETE, mai due).
 *
 * La cancellazione (`DELETE /letture/{id}`, qualunque Lettura — PRD:
 * "l'Utente può... cancellare ogni contenuto proprio") sta dentro il
 * menù della riga (design doc §9, punto 5, correzione del 20 agosto
 * 2026: "non un collegamento sottolineato ripetuto due volte"), non in
 * linea. Un primo clic sul menù apre "Cancella davvero"/"Annulla" al
 * posto delle date; niente modale.
 */
export function StoricoLetture({
  voceId,
  letture,
  isOwner,
}: {
  voceId: string;
  letture: Lettura[];
  /** Niente menù "⋯" di cancellazione sul libro di un collegato (issue
   * #3, Regola 5): l'RLS bloccherebbe comunque la scrittura, ma
   * l'affordance stessa non va mostrata (design doc §15, "nessuna
   * traccia di dove sarebbero" i comandi di scrittura). L'elenco in
   * sola lettura resta visibile: è un dato di lettura reciprocamente
   * condiviso (Regola 4). */
  isOwner: boolean;
}) {
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const spiega = useMessaggioErrore();
  const lingua = useLocale();
  const [inConfermaId, setInConfermaId] = useState<string | null>(null);
  const mutazione = useMutation({
    mutationFn: async (letturaId: string) => {
      const token = await getAccessToken();
      const result = await cancellaLettura(token, letturaId);
      if (result.status !== "ok") {
        throw new ErroreApp(
          result.status === "not_found" ? assenza("letturaSparita") : result.errore,
        );
      }
    },
    onSuccess: () => {
      setInConfermaId(null);
      void queryClient.invalidateQueries({ queryKey: ["voce", voceId] });
      void queryClient.invalidateQueries({ queryKey: ["voci"] });
    },
    onError: (error: unknown) => {
      showError(
        spiega("letturaNonCancellata", erroreDi(error)),
      );
    },
  });

  const unicaLetturaAperta = letture.length === 1 && letture[0].esito === null;
  if (letture.length === 0 || unicaLetturaAperta) return null;

  // Dal più recente, come gli insight: un elenco di letture è una
  // cronologia, e una cronologia si legge dall'ultima cosa successa.
  const recenti = [...letture].reverse();

  const puntoLettura = (lettura: Lettura) =>
    lettura.esito === null
      ? "bg-ribbon-reading ring-1 ring-inset ring-surface-2/70"
      : lettura.esito === "abbandonata"
        ? "bg-ribbon-abandoned"
        : "bg-ribbon-done";

  return (
    <div className="flex flex-col gap-4">
      <h2 className="t-section text-[0.9375rem]">
        {isOwner ? "Le letture" : "Le sue letture"}
      </h2>

      {/* Prima era un `<details>` con `summary` in `t-label` — corpo 10,5
          maiuscoletto — e sotto un elenco di righe di solo testo in
          `t-meta`: cioè una sezione della pagina annunciata dal carattere
          più piccolo dello schermo, e il suo contenuto vestito da
          didascalia. Ora è una carta con righe leggibili, sempre aperta:
          non c'è niente da nascondere in due o tre letture. */}
      <ul className="plane-1 grain flex flex-col px-4 sm:px-5">
        {recenti.map((lettura) => (
          <li
            key={lettura.id}
            className="flex min-h-[3.25rem] flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line py-3 first:border-t-0"
          >
            {inConfermaId === lettura.id ? (
              <>
                <span className="t-body min-w-0 flex-1 text-sm text-ink-soft">
                  Cancellare questa lettura?
                </span>
                <span className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={mutazione.isPending}
                    onClick={() => mutazione.mutate(lettura.id)}
                  >
                    Cancella davvero
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setInConfermaId(null)}>
                    Annulla
                  </Button>
                </span>
              </>
            ) : (
              <>
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className={`size-2.5 shrink-0 rounded-full ${puntoLettura(lettura)}`}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="t-body text-sm">
                      {periodoLettura(lettura, lingua)}
                      {lettura.esito ? ` · ${ETICHETTA_ESITO[lettura.esito]}` : ""}
                    </span>
                    <span className="t-meta">
                      {lettura.avanzamenti.length}{" "}
                      {lettura.avanzamenti.length === 1 ? "avanzamento" : "avanzamenti"}
                      {lettura.insight.length > 0 &&
                        ` · ${lettura.insight.length} insight`}
                    </span>
                  </span>
                </span>

                {isOwner && (
                  <Menu>
                    <MenuTrigger
                      render={
                        <Button variant="ghost" size="icon-sm" aria-label="Altre azioni">
                          <IconaAltro />
                        </Button>
                      }
                    />
                    <MenuContenuto align="end">
                      <MenuVoce onClick={() => setInConfermaId(lettura.id)}>Cancella</MenuVoce>
                    </MenuContenuto>
                  </Menu>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
