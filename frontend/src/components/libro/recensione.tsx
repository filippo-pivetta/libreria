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
import { Invito } from "@/components/ui/invito";
import { AzioniModulo } from "@/components/ui/azioni-modulo";
import { PastigliaInterruttore } from "@/components/ui/pastiglia-interruttore";
import { IconaCollegati, IconaLucchetto } from "@/components/ui/icone";
import { ErroreApp, assenza, erroreDi } from "@/lib/api/errore";
import { useMessaggioErrore } from "@/lib/messaggi-errore";
import { useTranslations } from "next-intl";

/**
 * Recensione (design doc §9): un paragrafo Literata sulla pagina destra,
 * sotto le stelle — una per Voce (PRD, entità Recensione), condivisa per
 * default. Annulla/Salva come `NotaIntenzione` e come i due moduli
 * dell'insight: `AzioniModulo`.
 *
 * **Qui l'esplicito conta più che altrove**, ed è la ragione per cui il
 * blur-salva è stato tolto per primo da questo componente (28 agosto
 * 2026). Due motivi che la nota non ha: la recensione la leggono i
 * collegati, quindi uscire dal campo la PUBBLICAVA; e svuotarla non la
 * azzera ma la CANCELLA (`DELETE`, perché il testo non è mai opzionale a
 * schema), quindi un campo svuotato per ripensarci e una finestra
 * cambiata distruggevano un testo che nessuno aveva chiesto di
 * distruggere. Adesso quel caso ha un nome sul bottone.
 *
 * Anche la visibilità entra nella scrittura invece di partire da sola al
 * tocco dell'interruttore: il modulo è tutto il pannello, intestazione
 * compresa, e un pannello con due modi di salvare sarebbe peggio di
 * quello che c'era prima. Chi la commuta e cambia idea preme Annulla.
 *
 * I bottoni compaiono solo mentre c'è qualcosa da decidere — `cambiato`
 * — e spariscono da soli subito dopo Salva o Annulla, invece di restare
 * lì spenti: stesso schema di `NotaIntenzione`.
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
  const t = useTranslations();
  const { showError } = useToast();
  const spiega = useMessaggioErrore();
  const [aperta, setAperta] = useState(recensione !== null);
  const [testo, setTesto] = useState(recensione?.testo ?? "");
  const [visibilita, setVisibilita] = useState<Visibilita>(recensione?.visibilita ?? "condiviso");
  // L'ultimo salvato che conosciamo, come in `NotaIntenzione`: da qui si
  // misura `cambiato`, non dalla prop `recensione` — quella si aggiorna
  // solo dopo il refetch che segue l'invalidazione, mentre i bottoni
  // devono sparire nell'istante in cui la scrittura riesce.
  const [salvato, setSalvato] = useState<{ testo: string; visibilita: Visibilita } | null>(
    recensione ? { testo: recensione.testo, visibilita: recensione.visibilita } : null,
  );
  const testoSalvato = salvato?.testo ?? "";
  const visibilitaSalvata: Visibilita = salvato?.visibilita ?? "condiviso";
  // Si adegua durante il render se cambia da fuori — pattern React per
  // "adjusting state when a prop changes", niente effetto. Il campo
  // segue solo se non c'è già una modifica in corso: un cambiamento
  // esterno non deve cancellare ciò che si sta scrivendo qui.
  if (
    (recensione?.testo ?? "") !== testoSalvato ||
    (recensione?.visibilita ?? "condiviso") !== visibilitaSalvata
  ) {
    if (testo === testoSalvato && visibilita === visibilitaSalvata) {
      setTesto(recensione?.testo ?? "");
      setVisibilita(recensione?.visibilita ?? "condiviso");
    }
    setSalvato(recensione ? { testo: recensione.testo, visibilita: recensione.visibilita } : null);
  }
  const conferma = useConfermaEffimera();

  function invalida() {
    void queryClient.invalidateQueries({ queryKey: ["voce", voceId] });
  }

  const mutazioneScrivi = useMutation({
    mutationFn: async (valori: { testo: string; visibilita: Visibilita }) => {
      const token = await getAccessToken();
      const result = await scriviRecensione(token, voceId, valori.testo, valori.visibilita);
      if (result.status !== "ok") {
        throw new ErroreApp(
          result.status === "not_found" ? assenza("voceSparita") : result.errore,
        );
      }
      return result.data;
    },
    onSuccess: (nuova) => {
      setSalvato({ testo: nuova.testo, visibilita: nuova.visibilita });
      invalida();
      conferma.mostra();
    },
    onError: (error: unknown) => {
      // Il testo resta in campo: vedi la stessa nota in
      // `nota-intenzione.tsx`. Qui pesa di più, perché una recensione è
      // il testo più lungo che l'app chieda di scrivere.
      showError(
        spiega("recensioneNonSalvata", erroreDi(error)),
      );
    },
  });

  const mutazioneCancella = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      const result = await cancellaRecensione(token, voceId);
      if (result.status !== "ok" && result.status !== "not_found") {
        throw new ErroreApp(result.errore);
      }
    },
    onSuccess: () => {
      invalida();
      // Azzerato esplicitamente, non solo implicito nel fatto che
      // svuotarlo è ciò che ha innescato la cancellazione: se il prop
      // `recensione` resta temporaneamente quello vecchio (l'invalidazione
      // è asincrona) e l'Utente riapre il campo prima che arrivi il
      // refetch, il modulo deve ripartire vuoto invece che con il testo
      // appena cancellato.
      setSalvato(null);
      setTesto("");
      setAperta(false);
    },
    onError: (error: unknown) => {
      // Qui invece il testo si RIPRISTINA: la cancellazione è fallita,
      // quindi la recensione c'è ancora, e il campo deve tornare a
      // mostrare quella che c'è davvero.
      showError(
        spiega("recensioneNonCancellata", erroreDi(error)),
      );
      setTesto(testoSalvato);
    },
  });

  const cambiato = testo.trim() !== testoSalvato || visibilita !== visibilitaSalvata;
  const cancella = salvato !== null && testo.trim() === "";
  const inCorso = mutazioneScrivi.isPending || mutazioneCancella.isPending;

  function salva() {
    if (cancella) {
      mutazioneCancella.mutate();
      return;
    }
    if (!cambiato || testo.trim() === "") return;
    mutazioneScrivi.mutate({ testo: testo.trim(), visibilita });
  }

  function annulla() {
    setTesto(testoSalvato);
    setVisibilita(visibilitaSalvata);
    // Aperta dall'invito e mai scritta: annullare la richiude, come nel
    // modulo dell'insight. Con una recensione già scritta il pannello
    // resta dov'è — i bottoni spariscono comunque, perché `cambiato`
    // torna falso.
    if (salvato === null) setAperta(false);
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
          onPressedChange={(condiviso) => setVisibilita(condiviso ? "condiviso" : "privato")}
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
          rows={5}
          placeholder="Cosa ne pensi?"
          className="t-appunto w-full resize-none border-0 bg-transparent text-ink outline-none placeholder:text-ink-soft"
        />
        {(cambiato || conferma.visibile) && (
          <div className="mt-3.5 flex flex-col gap-3 border-t border-line pt-3.5 sm:flex-row sm:items-center sm:gap-2.5">
            <Messaggio tono="conferma">{conferma.visibile ? t("conferme.salvato") : ""}</Messaggio>
            {cambiato && (
              <AzioniModulo
                etichettaSalva={cancella ? "Cancella la recensione" : "Salva"}
                salvaDisabilitato={inCorso}
                onSalva={salva}
                onAnnulla={annulla}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
