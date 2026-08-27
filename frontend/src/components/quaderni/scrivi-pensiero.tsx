"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { creaInsight, type Visibilita } from "@/lib/api/insight";
import { getVoci, type VoceConLibro } from "@/lib/api/voci";
import { getAccessToken } from "@/lib/api/access-token";
import { Button } from "@/components/ui/button";
import { CampoRicerca } from "@/components/ui/campo-ricerca";
import { InterruttoriScritto } from "@/components/ui/interruttori-scritto";
import { Messaggio } from "@/components/ui/messaggio";
import { attributiPastiglia, pastigliaVariants } from "@/components/ui/pastiglia";
import { cn } from "@/lib/utils";
import { assenza, erroreDi } from "@/lib/api/errore";
import { useMessaggioErrore } from "@/lib/messaggi-errore";

/** Quanti libri proporre prima di chiedere di scrivere il titolo. Sei
 * riempiono una riga su desktop e due su un telefono: oltre, il selettore
 * diventa lui l'oggetto della pagina. */
const PROPOSTI = 6;

/**
 * Scrivere un pensiero da Quaderni, scegliendo il libro.
 *
 * ---------------------------------------------------------------------------
 * CONTRADDICE §10, E §10 VA CORRETTA.
 *
 * "Solo dentro la scheda del libro. La vista trasversale è rinviata" è
 * stato scritto quando Quaderni non esisteva e i propri scritti vivevano
 * in un posto solo. Con una voce di navigazione intitolata alla materia,
 * la frase dice che il quaderno è l'unico quaderno in cui non si può
 * scrivere — e la scrittura è il gesto con cui quella materia esiste,
 * non un accessorio della scheda bibliografica.
 *
 * Il momento in cui si scrive un insight è quello in cui si ha il libro
 * in mano: da lì a "apri la Libreria, trova il volume, apri la scheda,
 * scorri fino agli insight" ci sono quattro passi, e la maggior parte
 * dei pensieri si perde in mezzo. Per questo i libri IN LETTURA sono
 * proposti per primi, già pronti da toccare.
 *
 * ---------------------------------------------------------------------------
 * LA CORREZIONE RESTA SULLA SCHEDA.
 *
 * Qui si scrive soltanto. Un secondo posto in cui modificare lo stesso
 * testo significa due superfici che devono restare d'accordo su spoiler,
 * visibilità e lettura di appartenenza; da Quaderni si arriva alla scheda
 * con un clic sul titolo, ed è lì che il testo si corregge — dove sta
 * anche il resto della sua storia.
 *
 * ---------------------------------------------------------------------------
 * IL MODULO È QUELLO DELLA SCHEDA, non uno che gli somiglia: stessa
 * `t-appunto` senza riquadro, stesse due pastiglie con `aria-pressed`,
 * stessa coppia Annulla/Salva in fondo a destra
 * (`libro/insight-lista.tsx`). L'unica aggiunta è la riga che qui serve e
 * là no — su quale libro.
 */
export function ScriviPensiero({ onChiudi }: { onChiudi: () => void }) {
  const queryClient = useQueryClient();
  const spiega = useMessaggioErrore();

  const [voceId, setVoceId] = useState<string | null>(null);
  const [cerca, setCerca] = useState("");
  const [testo, setTesto] = useState("");
  const [spoiler, setSpoiler] = useState(false);
  const [visibilita, setVisibilita] = useState<Visibilita>("condiviso");
  const [errore, setErrore] = useState<string | null>(null);

  const { data: voci } = useQuery({
    queryKey: ["voci"],
    queryFn: async () => {
      const token = await getAccessToken();
      const esito = await getVoci(token);
      return esito.status === "ok" ? esito.data : [];
    },
  });

  // In lettura e in pausa per prime, poi il resto dal più recente: è
  // l'ordine del bisogno, non quello dello scaffale (che è alfabetico
  // per cognome, §7, e serve alla memoria spaziale — qui servirebbe a
  // niente).
  const proposte = useMemo(() => {
    const tutte = voci ?? [];
    const termine = cerca.trim().toLowerCase();
    const corrisponde = (voce: VoceConLibro) =>
      !termine ||
      voce.libro.titoloCanonico.toLowerCase().includes(termine) ||
      voce.libro.autori.some((autore) => autore.nomeCanonico.toLowerCase().includes(termine));

    const peso = (voce: VoceConLibro) =>
      voce.stato === "in_lettura" ? 0 : voce.stato === "in_pausa" ? 1 : 2;

    return tutte
      .filter(corrisponde)
      .sort((a, b) => peso(a) - peso(b) || b.aggiornatoAt.localeCompare(a.aggiornatoAt))
      .slice(0, PROPOSTI);
  }, [voci, cerca]);

  const scelta = (voci ?? []).find((voce) => voce.id === voceId) ?? null;

  const salva = useMutation({
    mutationFn: async () => {
      if (!voceId) throw new Error("nessun libro");
      const token = await getAccessToken();
      return creaInsight(token, voceId, testo.trim(), spoiler, visibilita);
    },
    onMutate: () => setErrore(null),
    onSuccess: (esito) => {
      if (esito.status !== "ok") {
        setErrore(
          spiega("insightNonSalvato", esito.status === "error" ? esito.errore : assenza("voceSparita")),
        );
        return;
      }
      // Il corpus, i conteggi e i menù dei filtri cambiano tutti insieme:
      // un insight nuovo aggiunge una riga, sposta il totale e può
      // aggiungere un anno o un libro alle sfaccettature.
      void queryClient.invalidateQueries({ queryKey: ["scritti"] });
      void queryClient.invalidateQueries({ queryKey: ["voci"] });
      // Nessun toast di conferma: l'app non ne ha, e qui non servirebbe
      // comunque a niente â il pannello si chiude e la carta appena
      // scritta compare in cima al corpus, che è la conferma vera.
      // Il toast esiste per le scritture il cui bersaglio può essere
      // già scorso via (`providers/toast-provider.tsx`), e questo è
      // l'opposto: il bersaglio arriva sotto gli occhi.
      onChiudi();
    },
    onError: (err: unknown) => setErrore(spiega("insightNonSalvato", erroreDi(err))),
  });

  return (
    <section className="pannello plane-1 grain flex flex-col gap-4 rounded-card p-5 sm:p-6">
      <div className="flex flex-col gap-3 border-b border-line pb-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h2 className="t-label">Su quale libro</h2>
          {scelta && (
            <Button variant="quiet" size="testo" onClick={() => setVoceId(null)}>
              Cambia libro
            </Button>
          )}
        </div>

        {scelta ? (
          <p className="t-body">
            {scelta.libro.titoloCanonico}
            {scelta.libro.autori.length > 0 && (
              <span className="t-meta">
                {" "}
                · {scelta.libro.autori.map((autore) => autore.nomeCanonico).join(", ")}
              </span>
            )}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <CampoRicerca
              taglia="riga"
              valore={cerca}
              onCambia={setCerca}
              etichetta="Cerca un libro della tua libreria"
              segnaposto="Cerca fra i tuoi libri"
            />

            {proposte.length === 0 ? (
              <p className="t-meta">
                {cerca.trim()
                  ? "Nessun libro con questo titolo o autore."
                  : "Aggiungi un libro alla tua libreria prima di scrivere."}
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {proposte.map((voce) => (
                  <li key={voce.id}>
                    <button
                      type="button"
                      onClick={() => setVoceId(voce.id)}
                      {...attributiPastiglia}
                      className={cn(
                        pastigliaVariants({ taglia: "filtro" }),
                        "max-w-64 text-left",
                      )}
                    >
                      <span className="truncate text-ink">{voce.libro.titoloCanonico}</span>
                      {(voce.stato === "in_lettura" || voce.stato === "in_pausa") && (
                        <span className="t-meta shrink-0 text-[11px]">in lettura</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <textarea
        value={testo}
        onChange={(evento) => setTesto(evento.target.value)}
        rows={4}
        placeholder="Cosa ti ha colpito?"
        aria-label="Il tuo pensiero"
        className="t-appunto w-full resize-none border-0 bg-transparent text-ink outline-none placeholder:text-ink-soft"
      />

      {/* LA BARRA, IN DUE GRUPPI CHE NON SI MESCOLANO.

          Era un solo `flex-wrap` con quattro controlli e un `ml-auto` sul
          terzo: su 390px il punto in cui la riga si spezzava dipendeva
          dalla lunghezza delle etichette, non dal senso, e capitava che
          "Salva" finisse in riga con un interruttore. Ora sono due
          gruppi dichiarati — che cosa sarà questo testo, e cosa farne —
          impilati sotto i 640px e affiancati sopra. */}
      <div className="flex flex-col gap-3 border-t border-line pt-3.5 sm:flex-row sm:items-center sm:gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <InterruttoriScritto
            spoiler={spoiler}
            onSpoiler={setSpoiler}
            visibilita={visibilita}
            onVisibilita={setVisibilita}
          />
        </div>

        <div className="flex items-center gap-1.5 sm:ml-auto">
          <Button variant="ghost" className="flex-1 sm:flex-none" onClick={onChiudi}>
            Annulla
          </Button>
          <Button
            className="flex-1 sm:flex-none"
            disabled={!voceId || testo.trim() === "" || salva.isPending}
            onClick={() => salva.mutate()}
          >
            Salva
          </Button>
        </div>
      </div>

      <Messaggio>{errore}</Messaggio>
    </section>
  );
}
