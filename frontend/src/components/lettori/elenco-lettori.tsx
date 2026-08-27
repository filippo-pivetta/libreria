"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getUtenti, MIN_RICERCA, type ElencoMembri, type Membro } from "@/lib/api/utenti";
import {
  accettaCollegamento,
  inviaRichiesta,
  terminaCollegamento,
} from "@/lib/api/collegamenti";
import { getAccessToken } from "@/lib/api/access-token";
import { iniziali } from "@/lib/iniziali";
import { Button } from "@/components/ui/button";
import { CampoRicerca } from "@/components/ui/campo-ricerca";
import { IconaFreccia } from "@/components/ui/icone";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { ScheletroElenco } from "@/components/states/scheletri";
import { Messaggio } from "@/components/ui/messaggio";
import { ErroreApp, assenza, erroreDi, regola } from "@/lib/api/errore";
import { useMessaggioErrore } from "@/lib/messaggi-errore";

// Stessa costante di providers/toast-provider.tsx (DURATA_MS), per
// coerenza fra le finestre di "annulla" dell'app.
const ATTESA_INTERRUZIONE_MS = 6000;

// Quanto si aspetta prima di interrogare il server mentre si digita.
// Sotto i ~200ms si manda una richiesta per battuta; sopra i ~400ms si
// sente il ritardo.
const ATTESA_DIGITAZIONE_MS = 250;

/**
 * Lettori (design doc §16): le persone e l'intero ciclo di vita del
 * rapporto con loro, in una pagina sola.
 *
 * ---------------------------------------------------------------------
 * PERCHÉ NON È PIÙ COM'ERA
 *
 * Prima questa pagina mostrava i nomi e basta: accettare una richiesta,
 * ritirarne una, interrompere un collegamento si facevano nella Torre,
 * e qui una richiesta in attesa era testo inerte con una riga che
 * rimandava altrove. Stesso oggetto in due pagine, e quella dove sta la
 * persona era quella che non poteva agire — il contatore rosso in barra
 * non era una funzione, era la toppa che serviva a portarti nell'altra.
 *
 * L'elenco era anche diviso in due carte, "i tuoi collegamenti" e "altri
 * membri", per una ragione giusta (frequenze opposte) e con una
 * soluzione che risolveva l'ORDINE e non il TROVARE: per chiedere un
 * collegamento bisognava scorrere oltre tutti i collegati. Con
 * un'istanza aperta quella lista non finisce più. Ora la ricerca sta in
 * cima e raggiunge chiunque, e le sezioni servono solo a dire in che
 * stato è ciascuno.
 *
 * ---------------------------------------------------------------------
 * TRE SEZIONI, IN ORDINE DI URGENZA
 *
 * 1. Ti hanno chiesto il collegamento — l'unica cosa con una scadenza
 *    sociale. Quando non ce n'è, la sezione sparisce insieme al
 *    contatore: il caso normale non si annuncia.
 * 2. I tuoi collegamenti — pura navigazione. Nessuno stato scritto
 *    accanto (esserci è già lo stato) e nessun comando distruttivo a un
 *    dito dal gesto quotidiano: "Interrompi" compare solo in modalità
 *    Modifica.
 * 3. Altri lettori — chi non ha ancora una relazione, con in cima le
 *    richieste inviate. Ne arriva una fetta dal server, non l'anagrafica.
 */
export function ElencoLettori({ elencoIniziale }: { elencoIniziale: ElencoMembri }) {
  const queryClient = useQueryClient();
  const spiega = useMessaggioErrore();

  const [ricerca, setRicerca] = useState("");
  const [ricercaAttiva, setRicercaAttiva] = useState("");
  const [modifica, setModifica] = useState(false);
  const [errore, setErrore] = useState<{ id: string; messaggio: string } | null>(null);

  // Un collegamento "in interruzione" non ha ancora chiamato il server:
  // la DELETE parte solo quando i sei secondi scadono senza un Annulla.
  // Interrompere non è simmetricamente reversibile — si interrompe da
  // soli, ma per tornare indietro serve che l'altro accetti una nuova
  // richiesta — e questa è la finestra che rende innocuo un clic sbagliato.
  const [inInterruzione, setInInterruzione] = useState<Set<string>>(() => new Set());
  const timer = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const timers = timer.current;
    return () => {
      timers.forEach((handle) => clearTimeout(handle));
      timers.clear();
    };
  }, []);

  useEffect(() => {
    const termine = ricerca.trim();
    // Sotto il minimo non si interroga l'anagrafica, e il campo svuotato
    // torna subito all'elenco senza aspettare il ritardo.
    const prossima = termine.length >= MIN_RICERCA ? termine : "";
    if (prossima === ricercaAttiva) return;
    const handle = setTimeout(() => setRicercaAttiva(prossima), ATTESA_DIGITAZIONE_MS);
    return () => clearTimeout(handle);
  }, [ricerca, ricercaAttiva]);

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["utenti", ricercaAttiva],
    queryFn: async () => {
      const token = await getAccessToken();
      const result = await getUtenti(token, ricercaAttiva || undefined);
      if (result.status === "error") {
        throw new ErroreApp(result.errore);
      }
      return result.data;
    },
    // L'elenco senza ricerca è quello che il server ha già reso: non si
    // rifà una richiesta per mostrare ciò che è già in pagina.
    initialData: ricercaAttiva === "" ? elencoIniziale : undefined,
    placeholderData: (precedente) => precedente,
  });

  const invalida = () => {
    void queryClient.invalidateQueries({ queryKey: ["utenti"] });
    void queryClient.invalidateQueries({ queryKey: ["collegamenti"] });
  };

  const accetta = useMutation({
    mutationFn: async (collegamentoId: string) => {
      const token = await getAccessToken();
      const result = await accettaCollegamento(token, collegamentoId);
      if (result.status !== "ok") {
        throw new ErroreApp(
          result.status === "not_found" ? assenza("richiestaSparita") : result.errore,
        );
      }
    },
    onMutate: () => setErrore(null),
    onSuccess: invalida,
    onError: (err: unknown, id: string) =>
      setErrore({
        id,
        messaggio: spiega("richiestaNonAccettata", erroreDi(err)),
      }),
  });

  // Una sola mutazione per rifiuta / ritira / interrompi: sono la stessa
  // DELETE sulla riga della relazione, e distinguerle qui avrebbe
  // significato tre copie dello stesso gestore d'errore.
  const termina = useMutation({
    mutationFn: async (collegamentoId: string) => {
      const token = await getAccessToken();
      const result = await terminaCollegamento(token, collegamentoId);
      if (result.status !== "ok") {
        throw new ErroreApp(
          result.status === "not_found" ? assenza("collegamentoSparito") : result.errore,
        );
      }
    },
    onMutate: () => setErrore(null),
    onSuccess: invalida,
    onError: (err: unknown, id: string) =>
      setErrore({
        id,
        messaggio: spiega("collegamentoNonAggiornato", erroreDi(err)),
      }),
  });

  const chiedi = useMutation({
    mutationFn: async (utenteId: string) => {
      const token = await getAccessToken();
      const result = await inviaRichiesta(token, utenteId);
      if (result.status !== "ok") {
        throw new ErroreApp(
          result.status === "not_found"
            ? assenza("utenteSparito")
            : result.status === "richiesta_a_se_stessi"
              ? regola("richiesta_a_se_stessi")
              : result.errore,
        );
      }
    },
    onMutate: () => setErrore(null),
    onSuccess: invalida,
    onError: (err: unknown, id: string) =>
      setErrore({
        id,
        messaggio: spiega("richiestaNonInviata", erroreDi(err)),
      }),
  });

  function avviaInterruzione(collegamentoId: string) {
    setInInterruzione((precedente) => new Set(precedente).add(collegamentoId));
    const handle = setTimeout(() => {
      timer.current.delete(collegamentoId);
      setInInterruzione((precedente) => {
        const successivo = new Set(precedente);
        successivo.delete(collegamentoId);
        return successivo;
      });
      termina.mutate(collegamentoId);
    }, ATTESA_INTERRUZIONE_MS);
    timer.current.set(collegamentoId, handle);
  }

  function annullaInterruzione(collegamentoId: string) {
    const handle = timer.current.get(collegamentoId);
    if (handle) {
      clearTimeout(handle);
      timer.current.delete(collegamentoId);
    }
    setInInterruzione((precedente) => {
      const successivo = new Set(precedente);
      successivo.delete(collegamentoId);
      return successivo;
    });
  }

  if (isPending) {
    return (
      <div role="status" aria-busy>
        <span className="sr-only">Un momento…</span>
        <ScheletroElenco righe={5} />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        message={spiega("lettoriNonCaricati", erroreDi(error))}
        onRetry={() => void refetch()}
      />
    );
  }

  const cercando = ricercaAttiva !== "";
  const vuoto =
    data.richiesteRicevute.length === 0 &&
    data.collegati.length === 0 &&
    data.altri.length === 0;

  return (
    <div className="flex flex-col gap-8">
      {data.richiesteRicevute.length > 0 && (
        <Sezione titolo="Ti hanno chiesto il collegamento">
          <Carta>
            {data.richiesteRicevute.map((membro) => (
              <Riga key={membro.id} membro={membro} errore={errore}>
                <Button
                  size="sm"
                  onClick={() => accetta.mutate(membro.collegamentoId!)}
                  disabled={accetta.isPending && accetta.variables === membro.collegamentoId}
                >
                  Accetta
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => termina.mutate(membro.collegamentoId!)}
                  disabled={termina.isPending && termina.variables === membro.collegamentoId}
                >
                  Rifiuta
                </Button>
              </Riga>
            ))}
          </Carta>
        </Sezione>
      )}

      <div className="flex flex-col gap-3">
        {/* La ricerca sta in cima e raggiunge chiunque: è lei, e non
            l'ordine delle sezioni, a risolvere un elenco che non finisce.

            Campo a riga inferiore (`.field-line`), non il riquadro
            arrotondato di `ui/input.tsx`: è la stessa forma della ricerca
            dello scaffale e di quella del catalogo, che sono i due
            precedenti diretti. `<Input>` è il campo dei moduli — dove si
            compila qualcosa e si conferma; questo è un filtro su ciò che
            sta sotto, e nell'app quelli non hanno riquadro.

            Il conteggio a destra dice i COLLEGATI, che sono un dato di chi
            guarda. Non c'è e non ci sarà un totale dei membri: su
            un'istanza aperta quanti siano gli iscritti non è
            un'informazione che questa pagina debba dare. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <CampoRicerca
            taglia="riga"
            valore={ricerca}
            onCambia={setRicerca}
            etichetta="Cerca un lettore per nome"
            segnaposto="Nome di un lettore"
            className="min-w-0 flex-1 sm:max-w-sm sm:flex-none"
          />
          {data.collegati.length > 0 && (
            <span className="t-meta t-num shrink-0 sm:ml-auto">
              {data.collegati.length}{" "}
              {data.collegati.length === 1 ? "collegato" : "collegati"}
            </span>
          )}
        </div>

        {/* "Modifica" sull'intestazione del gruppo che modifica, non sul
            titolo di pagina: è il pattern dell'elenco iOS, e dice da sé su
            quali righe agisce.

            Passa dal primitivo `Button` come ogni altro comando dell'app —
            prima era un `<button>` nudo con `text-accent-strong` scritto a
            mano, quindi senza stato hover, senza il bersaglio a 44px sotto
            il dito e con un accento come testo che nessun altro comando
            usa. `ghost` per entrare, `secondary` per uscire: essere in una
            modalità si dichiara con un riempimento, e `surface-2` è il
            piano di ciò che è sollevato. */}
        {data.collegati.length > 0 && (
          <div className="flex items-center justify-between gap-4">
            <p className="t-label">I tuoi collegamenti</p>
            <Button
              variant={modifica ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={modifica}
              onClick={() => {
                setModifica((valore) => !valore);
                setErrore(null);
              }}
            >
              {modifica ? "Fine" : "Modifica"}
            </Button>
          </div>
        )}

        {data.collegati.length > 0 && (
          <Carta>
            {data.collegati.map((membro) => {
              const id = membro.collegamentoId!;
              if (inInterruzione.has(id)) {
                return (
                  <li
                    key={membro.id}
                    className="flex items-center justify-between gap-3 p-4"
                  >
                    <span className="t-meta min-w-0 flex-1 truncate">
                      {membro.nomeUtente} — collegamento interrotto
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => annullaInterruzione(id)}
                    >
                      Annulla
                    </Button>
                  </li>
                );
              }
              if (modifica) {
                return (
                  <Riga key={membro.id} membro={membro} errore={errore}>
                    <Button variant="outline" size="sm" onClick={() => avviaInterruzione(id)}>
                      Interrompi
                    </Button>
                  </Riga>
                );
              }
              return (
                <li key={membro.id}>
                  <Link
                    href={`/lettori/${membro.id}`}
                    className="flex items-center gap-3 p-4 transition-colors duration-(--dur-micro) hover:bg-surface-2"
                  >
                    <Iniziali nome={membro.nomeUtente} />
                    <span className="min-w-0 flex-1 truncate font-ui text-sm font-medium text-ink">
                      {membro.nomeUtente}
                    </span>
                    <IconaFreccia
                      aria-hidden
                      className="size-4 shrink-0 -rotate-90 text-ink-soft"
                    />
                  </Link>
                </li>
              );
            })}
          </Carta>
        )}

        {data.altri.length > 0 && (
          <div className="flex flex-col gap-2">
            {data.collegati.length > 0 && (
              <p className="t-label pt-2">{cercando ? "Non collegati" : "Altri lettori"}</p>
            )}
            <Carta>
              {data.altri.map((membro) =>
                membro.statoRelazione === "in_attesa" ? (
                  <Riga key={membro.id} membro={membro} errore={errore}>
                    <span className="t-meta">Richiesta inviata</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => termina.mutate(membro.collegamentoId!)}
                      disabled={
                        termina.isPending && termina.variables === membro.collegamentoId
                      }
                    >
                      Ritira
                    </Button>
                  </Riga>
                ) : (
                  <Riga key={membro.id} membro={membro} errore={errore}>
                    {/* "Chiedi il collegamento" era l'unica etichetta di
                        tre parole in una colonna di verbi singoli —
                        Accetta, Rifiuta, Ritira, Interrompi — e misurava
                        165px in una riga che su 390px ne ha 358 in tutto,
                        iniziali e nome compresi. Il nome, che è il dato
                        della riga, si schiacciava per far posto al
                        comando. La frase intera resta dove serve davvero:
                        nell'etichetta accessibile, che dice anche A CHI —
                        cosa che il testo visibile non poteva fare, e che a
                        chi ascolta l'elenco serve più che a chi lo
                        guarda. */}
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={`Chiedi il collegamento a ${membro.nomeUtente}`}
                      onClick={() => chiedi.mutate(membro.id)}
                      disabled={chiedi.isPending && chiedi.variables === membro.id}
                    >
                      Chiedi
                    </Button>
                  </Riga>
                ),
              )}
            </Carta>
          </div>
        )}

        {!cercando && data.altri.length > 0 && (
          <p className="t-meta max-w-md">
            Gli ultimi arrivati. Per trovare qualcun altro, cerca il nome.
          </p>
        )}

        {cercando && vuoto && !isFetching && (
          <p className="t-meta">Nessun lettore con questo nome.</p>
        )}
      </div>

      {!cercando && vuoto && (
        <EmptyState
          title="Nessun altro lettore"
          description="Nessun altro è ancora entrato. Quando arriverà qualcuno lo troverai qui."
        />
      )}
    </div>
  );
}

function Sezione({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="t-section">{titolo}</h2>
      {children}
    </section>
  );
}

function Carta({ children }: { children: React.ReactNode }) {
  return (
    <ul className="plane-1 grain divide-y divide-line overflow-hidden rounded-card">
      {children}
    </ul>
  );
}

/** Iniziali in Fraunces, nessuna immagine di profilo — il PRD non la
 * prevede, e su un'istanza aperta un avatar sarebbe anche la prima cosa
 * da moderare. */
function Iniziali({ nome }: { nome: string }) {
  return (
    <span
      aria-hidden
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 font-display text-sm text-ink-soft"
    >
      {iniziali(nome)}
    </span>
  );
}

function Riga({
  membro,
  errore,
  children,
}: {
  membro: Membro;
  errore: { id: string; messaggio: string } | null;
  children: React.ReactNode;
}) {
  const idErrore = membro.collegamentoId ?? membro.id;
  return (
    /* Due righe, non tre colonne: il messaggio stava nella colonna
       `shrink-0` del comando, che non cede, e il suo testo schiacciava il
       nome utente accanto fino a troncarlo a una lettera (stesso difetto
       corretto in `ricerca/riga-risultato.tsx`). Ora la riga resta intatta
       e il messaggio le sta sotto, a tutta larghezza.

       E il `Messaggio` non sta più dentro un `&&`: il suo contenitore deve
       restare montato anche quando non ha nulla da dire, altrimenti la
       regione `aria-live` nasce insieme al proprio contenuto e diverse
       tecnologie assistive non la annunciano (vedi `ui/messaggio.tsx`).
       Vuoto, esce dal flusso da sé. */
    <li className="flex flex-col gap-1 p-4">
      <div className="flex items-center gap-3">
        <Iniziali nome={membro.nomeUtente} />
        {/* `min-w-0` più `truncate`: senza il primo il secondo non fa nulla
            — un figlio flex non scende sotto la larghezza del proprio
            contenuto se non glielo si concede. Era il motivo per cui su un
            telefono un nome lungo spingeva il comando fuori dalla riga
            invece di troncarsi. */}
        <span className="min-w-0 flex-1 truncate font-ui text-sm font-medium text-ink">
          {membro.nomeUtente}
        </span>
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      </div>
      <Messaggio className="text-right">
        {errore?.id === idErrore ? errore.messaggio : null}
      </Messaggio>
    </li>
  );
}
