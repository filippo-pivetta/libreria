"use client";

import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";

import { cercaSemantica, type RicercaSemantica as Esito } from "@/lib/api/ricerca-semantica";
import { getAccessToken } from "@/lib/api/access-token";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states/empty-state";
import { Messaggio } from "@/components/ui/messaggio";
import { Risultati } from "@/components/quaderni/risultati";
import { Temi } from "@/components/quaderni/temi";

/**
 * Quaderni (design doc §22): ciò che l'Utente ha scritto — i propri insight e
 * le proprie recensioni — con i due modi di attraversarlo.
 *
 * ---------------------------------------------------------------------------
 * TRE PAGINE ORFANE DIVENTATE UNA VOCE DI NAVIGAZIONE.
 *
 * `/cerca` e `/sintesi` erano due pagine con lo stesso identico impianto —
 * titolo, paragrafo di spiegazione, un comando, un elenco — che nascevano
 * entrambe vuote e si raggiungevano solo da un <details> chiuso, in 13 px di
 * inchiostro tenue, in mezzo ai filtri della Libreria. (La terza, i
 * suggerimenti di lettura, è andata in "Aggiungi un libro": lì il bisogno è
 * lo stesso, voglio un libro nuovo.)
 *
 * Non sono due funzioni diverse: sono la stessa materia interrogata o vista
 * da lontano. Da qui la fusione — un campo solo, e sotto UNA regione sola.
 *
 * ---------------------------------------------------------------------------
 * UNA REGIONE, E LA SUA INTESTAZIONE DICE COSA CONTIENE.
 *
 * A riposo i temi (`Temi`), dopo una domanda i risultati (`Risultati`), con il
 * ritorno accanto. I risultati PRENDONO IL POSTO dei temi e non si accodano
 * sotto: una pagina con i risultati di una domanda e sotto un elenco di temi
 * che non c'entrano è un elenco di troppo. Svuotare il campo fa la stessa
 * cosa del ritorno, ma un campo da svuotare non è una via d'uscita che si
 * vede — per questo il ritorno è scritto.
 *
 * **Non cerca mentre si digita**, a differenza del filtro dello scaffale e
 * della ricerca sui cataloghi (§13): ogni interrogazione è una chiamata al
 * fornitore, e una domanda in linguaggio naturale si finisce di scrivere
 * prima di volerla porre.
 *
 * A consenso revocato la pagina resta e lo dichiara (le due regioni hanno il
 * loro stato "spenta"): è una materia che esiste comunque, ed è solo il modo
 * di interrogarla che si spegne.
 */
export function Quaderni() {
  const [domanda, setDomanda] = useState("");
  const [spenta, setSpenta] = useState(false);
  const [esito, setEsito] = useState<Esito | null>(null);
  const [chiesto, setChiesto] = useState("");
  const [errore, setErrore] = useState<string | null>(null);

  const mutazione = useMutation({
    mutationFn: async (testo: string) => {
      const token = await getAccessToken();
      return cercaSemantica(token, testo);
    },
    onMutate: () => {
      setErrore(null);
      setSpenta(false);
    },
    onSuccess: (result, testo) => {
      if (result.status === "consenso_revocato") {
        setSpenta(true);
        setEsito(null);
        return;
      }
      if (result.status === "error") {
        setErrore(result.message);
        return;
      }
      setChiesto(testo);
      setEsito(result.data);
    },
    onError: () => setErrore("La ricerca non è arrivata. Riprova."),
  });

  function invia(evento: FormEvent) {
    evento.preventDefault();
    const testo = domanda.trim();
    if (testo.length < 2) return;
    mutazione.mutate(testo);
  }

  function tornaAiTemi() {
    setDomanda("");
    setEsito(null);
    setChiesto("");
    setSpenta(false);
    setErrore(null);
  }

  const inRicerca = esito !== null;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        {/* t-display 44/56px, non t-title: è il titolo DI PAGINA, la stessa
            misura di Lettori e Profilo (design doc, "un titolo di pagina ha
            una misura sola in tutta l'app, non una a scelta di chi scrive la
            pagina") — `.t-title` è il ruolo per titoli di libro/sezione, un
            registro diverso e più piccolo che qui stava per svista. */}
        <h1 className="t-display text-[44px] sm:text-[56px]">Quaderni</h1>
        <p className="t-meta max-w-prose">
          Ciò che hai scritto leggendo. Cerca per significato dentro i tuoi insight e le tue
          recensioni — non per parola esatta — e guarda i temi che tornano quando attraversano
          libri diversi. Solo i tuoi testi: quelli dei tuoi collegati restano fuori.
        </p>
      </section>

      <form onSubmit={invia} className="flex items-end gap-3">
        <label className="flex-1">
          <span className="sr-only">Cosa cerchi</span>
          <input
            type="search"
            value={domanda}
            onChange={(e) => setDomanda(e.target.value)}
            placeholder="Che cosa ho scritto sul tempo?"
            aria-label="Cerca nei tuoi quaderni"
            className="field-line w-full border-0 border-b border-line bg-transparent pb-1 font-ui text-base text-ink outline-none placeholder:text-ink-soft"
          />
        </label>
        <Button type="submit" disabled={mutazione.isPending || domanda.trim().length < 2}>
          Cerca
        </Button>
      </form>

      <Messaggio>{errore}</Messaggio>

      {spenta ? (
        <EmptyState
          title="L’elaborazione assistita è spenta"
          description="La ricerca per significato è una delle funzioni che dipendono dal consenso. Riaccendilo dal tuo profilo e gli indici si ricostruiscono da soli."
        />
      ) : inRicerca && esito ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <p className="t-section">
              {esito.risultati.length}{" "}
              {esito.risultati.length === 1 ? "risultato" : "risultati"} per “{chiesto}”
            </p>
            <button
              type="button"
              onClick={tornaAiTemi}
              className="tocco-esteso t-meta underline decoration-line-strong underline-offset-4 hover:decoration-ink"
            >
              ‹ Torna ai temi
            </button>
          </div>
          <Risultati esito={esito} />
        </div>
      ) : (
        <Temi />
      )}
    </div>
  );
}
