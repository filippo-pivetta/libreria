"use client";

import { useState } from "react";

import { useConfermaEffimera } from "@/lib/hooks/use-conferma-effimera";
import { Messaggio } from "@/components/ui/messaggio";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { correggiNotaIntenzione } from "@/lib/api/voci";
import { getAccessToken } from "@/lib/api/access-token";
import { useToast } from "@/providers/toast-provider";
import { Invito } from "@/components/ui/invito";
import { AzioniModulo } from "@/components/ui/azioni-modulo";
import { IconaLucchetto } from "@/components/ui/icone";
import { ErroreApp, assenza, erroreDi } from "@/lib/api/errore";
import { useMessaggioErrore } from "@/lib/messaggi-errore";
import { useTranslations } from "next-intl";

/**
 * Nota di intenzione (design doc §9): solo il proprietario la vede, mai
 * un collegato — questo componente non riceve mai `isOwner`, perché
 * chi chiama (Scheda) non lo monta affatto per una voce altrui.
 *
 * **Annulla/Salva, come ogni altro modulo di scrittura dell'app** (28
 * agosto 2026). Prima salvava all'uscita dal campo, come `CorreggiPagine`,
 * e la stessa pagina portava tre superfici di prosa con due grammatiche
 * diverse: l'insight chiedeva un gesto esplicito, la nota e la recensione
 * si scrivevano da sole appena si guardava altrove. Su un campo che
 * contiene un numero — le pagine adottate — il blur-salva funziona,
 * perché il valore è uno e si vede subito se è cambiato; su un paragrafo
 * no, e sulla recensione era anche pericoloso, visto che svuotarla e
 * cliccare fuori la cancellava senza che nessuno l'avesse chiesto.
 *
 * I due bottoni compaiono solo quando c'è qualcosa da decidere —
 * `cambiato`, cioè il testo differisce dall'ultimo salvato — e
 * spariscono da soli subito dopo Salva o Annulla, senza restare lì
 * spenti. Resta `useConfermaEffimera` per la riga "Salvato.": il gesto
 * non è più ambiguo, ma il pannello resta aperto dopo il salvataggio e
 * sullo schermo non cambia nient'altro. Mai un toast: quello è
 * riservato agli errori (design doc §19).
 */
export function NotaIntenzione({
  voceId,
  notaIntenzione,
}: {
  voceId: string;
  notaIntenzione: string | null;
}) {
  const queryClient = useQueryClient();
  const t = useTranslations();
  const { showError } = useToast();
  const spiega = useMessaggioErrore();
  const [aperta, setAperta] = useState(notaIntenzione !== null);
  const [testo, setTesto] = useState(notaIntenzione ?? "");
  // L'ultimo valore che sappiamo salvato: dalla prop in arrivo o da una
  // scrittura riuscita. `cambiato`, sotto, si misura contro questo e non
  // contro `notaIntenzione` direttamente — la prop si aggiorna solo dopo
  // il refetch che segue l'invalidazione, mentre i bottoni devono sparire
  // nell'istante in cui la mutazione riesce, non quando la query torna.
  const [salvato, setSalvato] = useState(notaIntenzione);
  // Si adegua durante il render se cambia da fuori (un altro dispositivo,
  // il refetch stesso) — pattern React per "adjusting state when a prop
  // changes", niente effetto. Il testo in campo segue solo se non c'è
  // già una modifica in corso: un cambiamento esterno non deve cancellare
  // ciò che si sta scrivendo qui.
  if (notaIntenzione !== salvato) {
    if (testo === (salvato ?? "")) setTesto(notaIntenzione ?? "");
    setSalvato(notaIntenzione);
  }
  const conferma = useConfermaEffimera();

  const mutazione = useMutation({
    mutationFn: async (valore: string | null) => {
      const token = await getAccessToken();
      const result = await correggiNotaIntenzione(token, voceId, valore);
      if (result.status !== "ok") {
        throw new ErroreApp(
          result.status === "not_found" ? assenza("voceSparita") : result.errore,
        );
      }
      return result.data;
    },
    onSuccess: (voce) => {
      setSalvato(voce.notaIntenzione);
      void queryClient.invalidateQueries({ queryKey: ["voce", voceId] });
      conferma.mostra();
    },
    onError: (error: unknown) => {
      // Il testo resta in campo. Col blur-salva si ripristinava il
      // valore precedente — nessuno aveva chiesto di scrivere, e tenere
      // in campo una versione rifiutata era peggio — ma qui l'Utente ha
      // premuto Salva: cancellargli quello che ha scritto gli toglie
      // l'unica copia che esiste. Il toast dice cos'è andato storto, e
      // si ripreme.
      showError(spiega("notaNonSalvata", erroreDi(error)));
    },
  });

  const cambiato = testo.trim() !== (salvato ?? "");
  // Svuotare il campo e salvare toglie la nota. È un caso legittimo — la
  // colonna ammette il nullo — ma è distruttivo, e un bottone che dice
  // "Salva" mentre cancella è la stessa mezza verità del blur che
  // salvava da solo: qui il comando dice cosa fa.
  const cancella = salvato !== null && testo.trim() === "";

  function salva() {
    if (!cambiato) return;
    mutazione.mutate(testo.trim() === "" ? null : testo.trim());
  }

  function annulla() {
    setTesto(salvato ?? "");
    // Aperta dall'invito e mai salvata: annullare la richiude, come fa
    // il modulo dell'insight. Con una nota già scritta il pannello resta
    // dov'è, perché è anche la sua unica forma di lettura — i bottoni
    // spariscono comunque, perché `cambiato` torna falso.
    if (salvato === null) setAperta(false);
  }

  if (!aperta) {
    return <Invito onClick={() => setAperta(true)}>Aggiungi una nota di intenzione</Invito>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <span className="t-section font-medium text-ink-soft">Nota di intenzione</span>
        {/* La nota nasce privata e resta tale, sempre (PRD): non c'è un
            interruttore da offrire, quindi il segno è fermo e lo dice. */}
        <span className="t-meta inline-flex items-center gap-2">
          <IconaLucchetto className="size-[0.9375rem] shrink-0" />
          Solo tua, mai condivisa
        </span>
      </div>
      <div className="pannello rounded-field border border-line bg-surface-2 p-4 sm:px-[1.125rem]">
        <textarea
          value={testo}
          onChange={(event) => setTesto(event.target.value)}
          rows={3}
          placeholder="Perché vuoi leggerlo, o chi te l’ha consigliato…"
          className="t-appunto w-full resize-none border-0 bg-transparent text-ink outline-none placeholder:text-ink-soft"
        />
        {(cambiato || conferma.visibile) && (
          <div className="mt-3.5 flex flex-col gap-3 border-t border-line pt-3.5 sm:flex-row sm:items-center sm:gap-2.5">
            <Messaggio tono="conferma">{conferma.visibile ? t("conferme.salvato") : ""}</Messaggio>
            {cambiato && (
              <AzioniModulo
                etichettaSalva={cancella ? "Cancella la nota" : "Salva"}
                salvaDisabilitato={mutazione.isPending}
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
