"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { cambiaStato, type StatoVoce, type VoceDettaglio } from "@/lib/api/voci";
import { getAccessToken } from "@/lib/api/access-token";
import { useToast } from "@/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { CampoData } from "@/components/ui/campo-data";
import { Menu, MenuContenuto, MenuTrigger, MenuVoce } from "@/components/ui/menu";
import { IconaFreccia } from "@/components/ui/icone";
import { ErroreApp, assenza } from "@/lib/api/errore";
import { useAvvisa } from "@/lib/messaggi-errore";

type Transizione = { stato: StatoVoce; etichetta: string; chiedeData?: boolean };

/**
 * Rispecchia esattamente la matrice validata da `cambia_stato_voce`
 * (supabase/migrations/20260820065144_ciclo_di_lettura.sql, docs/adr/0015):
 * "l'interfaccia non offre mai una transizione vietata, invece di
 * offrirla e poi rifiutarla" (design doc §9). Se la matrice della RPC
 * cambia, questa tabella va aggiornata insieme.
 */
const TRANSIZIONI: Record<StatoVoce, Transizione[]> = {
  // `chiedeData`: il PRD lo impone esplicitamente ("entrambe le date sono
  // scelte dall'Utente, con il giorno corrente come predefinito: è ciò
  // che permette di registrare letture concluse prima di usare l'app").
  // Senza, la data di inizio resterebbe sempre oggi, e con essa il
  // minimo selezionabile per ogni avanzamento — impedendo di fatto di
  // registrare una lettura già cominciata in passato.
  da_leggere: [{ stato: "in_lettura", etichetta: "Inizia a leggere", chiedeData: true }],
  in_lettura: [
    { stato: "in_pausa", etichetta: "Metti in pausa" },
    { stato: "letto", etichetta: "Ho finito", chiedeData: true },
    { stato: "abbandonato", etichetta: "Abbandona", chiedeData: true },
    { stato: "da_leggere", etichetta: "Annulla la lettura" },
  ],
  in_pausa: [
    { stato: "in_lettura", etichetta: "Riprendi" },
    { stato: "letto", etichetta: "Ho finito", chiedeData: true },
    { stato: "abbandonato", etichetta: "Abbandona", chiedeData: true },
    { stato: "da_leggere", etichetta: "Annulla la lettura" },
  ],
  letto: [
    { stato: "in_lettura", etichetta: "Rileggi", chiedeData: true },
    { stato: "da_leggere", etichetta: "Rimetti in coda" },
  ],
  abbandonato: [
    { stato: "in_lettura", etichetta: "Riprendi", chiedeData: true },
    { stato: "da_leggere", etichetta: "Rimetti in coda" },
  ],
};

// Le due azioni frequenti restano sempre in vista, in contorno (mai
// piene: l'unica azione piena della pagina è "Salva" dell'avanzamento).
// Tutte le altre — comprese quelle che annullano una lettura — stanno
// sotto "Altro", in tono piano: design doc §9, punto 1, correzione del
// 20 agosto 2026 ("oggi quattro comandi hanno lo stesso peso e uno di
// essi cancella la lettura in corso"). Gli stati con due sole transizioni
// non hanno bisogno del menù: nascondere l'unica alternativa non
// semplifica nulla.
const FREQUENTI: Partial<Record<StatoVoce, StatoVoce[]>> = {
  in_lettura: ["in_pausa", "letto"],
  in_pausa: ["in_lettura", "letto"],
};

function oggiISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TransizioniStato({ voce }: { voce: VoceDettaglio }) {
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const avvisa = useAvvisa();
  const [pendente, setPendente] = useState<Transizione | null>(null);
  const [data, setData] = useState<string>(oggiISO);
  const mutazione = useMutation({
    mutationFn: async ({ stato, conData }: { stato: StatoVoce; conData?: string }) => {
      const token = await getAccessToken();
      const result = await cambiaStato(token, voce.id, stato, conData);
      if (result.status !== "ok") {
        // Il 409 porta il proprio `error_code`
        // (`transizione_stato_non_ammessa`): la sua frase nomina la regola,
        // ed è più utile di "Lo stato non è cambiato. Riprova fra poco.",
        // che manderebbe a ritentare all'infinito una cosa vietata.
        throw new ErroreApp(
          result.status === "not_found" ? assenza("voceSparita") : result.errore,
        );
      }
      return result.data;
    },
    onSuccess: () => {
      setPendente(null);
      void queryClient.invalidateQueries({ queryKey: ["voce", voce.id] });
      void queryClient.invalidateQueries({ queryKey: ["voci"] });
    },
    onError: (error: unknown, valori: { stato: StatoVoce; conData?: string }) => {
      avvisa(showError, "statoNonCambiato", error, () => mutazione.mutate(valori));
    },
  });

  const opzioni = TRANSIZIONI[voce.stato];
  if (opzioni.length === 0) return null;

  const nomiFrequenti = FREQUENTI[voce.stato];
  const frequenti = nomiFrequenti
    ? opzioni.filter((o) => nomiFrequenti.includes(o.stato))
    : opzioni;
  const altre = nomiFrequenti ? opzioni.filter((o) => !nomiFrequenti.includes(o.stato)) : [];

  function avvia(opzione: Transizione) {
    if (opzione.chiedeData) {
      setData(oggiISO());
      setPendente(opzione);
    } else {
      mutazione.mutate({ stato: opzione.stato });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        {frequenti.map((opzione) => (
          <Button
            key={opzione.stato}
            variant="outline"
            disabled={mutazione.isPending}
            onClick={() => avvia(opzione)}
          >
            {opzione.etichetta}
          </Button>
        ))}

        {altre.length > 0 && (
          // Prima era un `<details>` che si apriva al passaggio del mouse e
          // si chiudeva con un `setTimeout` di 350 ms: sotto il dito il
          // `mouseleave` non arriva mai, quindi il menù non si chiudeva
          // affatto. Vedi components/ui/menu.tsx.
          <Menu>
            <MenuTrigger
              render={
                <Button variant="ghost" data-icon="inline-end">
                  Altro
                  <IconaFreccia />
                </Button>
              }
            />
            <MenuContenuto align="start">
              {altre.map((opzione) => (
                <MenuVoce
                  key={opzione.stato}
                  disabled={mutazione.isPending}
                  onClick={() => avvia(opzione)}
                >
                  {opzione.etichetta}
                </MenuVoce>
              ))}
            </MenuContenuto>
          </Menu>
        )}
      </div>

      {/* Quattro elementi in `flex-wrap` su 390px si spezzavano in tre
          righe di cui l'ultima portava "Annulla" da solo, allineato a
          sinistra: la via d'uscita nel punto più simile a un'azione
          primaria. Ora è una struttura dichiarata — la frase, poi la
          data, poi i due comandi affiancati che si dividono la riga — e
          da 640px in su torna tutto su una riga sola. */}
      {pendente && (
        <div className="pannello plane-1 grain flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="t-body min-w-0 text-sm sm:flex-1">{pendente.etichetta}, con data</span>
          <CampoData
            riquadro
            id="data-transizione"
            ariaLabel="Data"
            value={data}
            max={oggiISO()}
            onChange={setData}
          />
          <div className="flex items-center gap-2">
            <Button
              className="flex-1 sm:flex-none"
              disabled={mutazione.isPending}
              onClick={() => mutazione.mutate({ stato: pendente.stato, conData: data })}
            >
              Conferma
            </Button>
            <Button
              variant="ghost"
              className="flex-1 sm:flex-none"
              onClick={() => setPendente(null)}
            >
              Annulla
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
