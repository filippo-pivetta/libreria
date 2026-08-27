"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Toast = {
  id: number;
  message: string;
  /** Il rimedio, quando esiste ed è davvero eseguibile. */
  onRiprova?: () => void;
  inUscita?: boolean;
};

type ToastContextValue = {
  /** Un errore di scrittura (avanzamento, cambio di stato, correzione
   * pagine, cancellazione di una lettura): compare come toast transitorio.
   * Deviazione esplicita da design-frontend.md §19 ("nessun avviso che si
   * sovrappone"), decisa in corso d'opera. Resta ferma la regola che il
   * rosso (`alert`) non compare mai su un errore: il toast è testo su piano
   * 2, non un riquadro d'allarme.
   *
   * **Quando usarlo, e quando no** (regola scritta nella sessione UI, perché
   * prima non c'era e i due canali si mescolavano a caso): il toast serve
   * quando il bersaglio della scrittura può essere già scorso via, o quando
   * la scrittura è ottimistica e l'errore arriva dopo che l'interfaccia si è
   * già mossa. Se il comando è ancora sotto gli occhi — un pulsante "Genera",
   * una riga di elenco, un campo — l'errore va accanto a quello, con
   * `<Messaggio>`: un toast in fondo alla pagina non dice a quale riga si
   * riferisce.
   *
   * **`onRiprova`, quando c'è, è metà del senso del toast.** Se il
   * bersaglio è già scorso via, dire "Riprova" senza offrire dove
   * significa mandare l'utente a ritrovare da solo la riga, il campo o la
   * stella che aveva toccato. Il comando va dove sta il messaggio — è il
   * modello dell'"Annulla" di Gmail, e Linear lo usa per la stessa
   * ragione. Va passato **solo** dove riprovare può funzionare
   * (`riprovabile()` in `lib/messaggi-errore.ts`): offrirlo su un 409 o
   * su una sessione scaduta è invitare a ripetere una cosa che la regola
   * vieta. */
  showError: (message: string, onRiprova?: () => void) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATA_MS = 6000;
/** Quanto dura l'uscita. Deve combaciare con `--dur-panel` in tokens.css. */
const DURATA_USCITA_MS = 240;
/**
 * Oltre tre, una pila di toast smette di essere un avviso e diventa un muro
 * che copre la pagina. I più vecchi cedono il posto ai più recenti, che sono
 * quelli che descrivono ciò che l'utente ha appena fatto.
 */
const MASSIMO_IN_PILA = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const contatore = useRef(0);
  const timer = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  /** In pausa mentre il puntatore o il fuoco sono sulla pila: sei secondi
   * sono pochi per leggere un errore lungo, e sparire mentre qualcuno sta
   * allungando la mano verso "Chiudi" è il difetto classico del toast. */
  const inPausa = useRef(false);
  const scadenze = useRef(new Map<number, number>());

  const scarta = useCallback((id: number) => {
    const scaduto = timer.current.get(id);
    if (scaduto) {
      clearTimeout(scaduto);
      timer.current.delete(id);
    }
    scadenze.current.delete(id);
    // Prima si marca in uscita, poi si toglie: senza questo passaggio il
    // toast spariva di colpo, mentre entrando aveva un'animazione. Un
    // ingresso animato e un'uscita secca si notano proprio perché sono
    // asimmetrici (design doc §7 sulla simmetria dei percorsi).
    setToasts((precedenti) =>
      precedenti.map((t) => (t.id === id ? { ...t, inUscita: true } : t)),
    );
    setTimeout(() => {
      setToasts((precedenti) => precedenti.filter((t) => t.id !== id));
    }, DURATA_USCITA_MS);
  }, []);

  const programma = useCallback(
    (id: number, ms: number) => {
      scadenze.current.set(id, Date.now() + ms);
      timer.current.set(
        id,
        setTimeout(() => scarta(id), ms),
      );
    },
    [scarta],
  );

  const showError = useCallback(
    (message: string, onRiprova?: () => void) => {
      const id = contatore.current++;
      setToasts((precedenti) => {
        const successivi = [...precedenti, { id, message, onRiprova }];
        // Scarta i più vecchi oltre il tetto, senza animazione d'uscita:
        // stanno già lasciando il posto, e animarne l'uscita mentre un altro
        // entra darebbe due movimenti contemporanei in direzioni opposte.
        const troppi = successivi.length - MASSIMO_IN_PILA;
        if (troppi > 0) {
          successivi.slice(0, troppi).forEach((t) => {
            const scaduto = timer.current.get(t.id);
            if (scaduto) clearTimeout(scaduto);
            timer.current.delete(t.id);
            scadenze.current.delete(t.id);
          });
          return successivi.slice(troppi);
        }
        return successivi;
      });
      programma(id, DURATA_MS);
    },
    [programma],
  );

  /** Tutti i timer cadono con il provider. */
  useEffect(() => {
    const timerCorrenti = timer.current;
    return () => {
      timerCorrenti.forEach(clearTimeout);
      timerCorrenti.clear();
    };
  }, []);

  function sospendi() {
    if (inPausa.current) return;
    inPausa.current = true;
    const ora = Date.now();
    timer.current.forEach((t, id) => {
      clearTimeout(t);
      const scadenza = scadenze.current.get(id) ?? ora;
      // Si conserva il tempo che restava, non si riparte da zero.
      scadenze.current.set(id, Math.max(0, scadenza - ora));
    });
    timer.current.clear();
  }

  function riprendi() {
    if (!inPausa.current) return;
    inPausa.current = false;
    scadenze.current.forEach((rimasto, id) => {
      programma(id, Math.max(600, rimasto));
    });
  }

  return (
    <ToastContext.Provider value={{ showError }}>
      {children}
      {/* Fondo pagina, non centro schermo: uno stile "Notion", che non copre
      il pannello con cui si stava lavorando. Sotto i 640px si alza sopra la
      barra di navigazione (`.sopra-la-barra` in tokens.css).

      Il contenitore NON porta più `aria-live`: ce l’aveva insieme a
      `role="alert"` su ogni voce, e i due si sommavano — diverse tecnologie
      assistive leggevano lo stesso errore due volte. Resta il solo
      `role="alert"` sulla voce, che è già una regione live assertiva per
      definizione ed è il posto giusto, perché è il testo a essere nuovo, non
      il contenitore. */}
      <div className="sopra-la-barra pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="alert"
            onMouseEnter={sospendi}
            onMouseLeave={riprendi}
            onFocusCapture={sospendi}
            onBlurCapture={riprendi}
            data-uscita={toast.inUscita ? "" : undefined}
            className="plane-2 grain toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 px-4 py-3 text-sm text-ink"
          >
            <p className="flex-1 text-pretty">{toast.message}</p>
            <div className="flex shrink-0 items-center gap-3 self-center">
              {toast.onRiprova && (
                /* Prima del "Chiudi" e in inchiostro pieno: dei due è
                   quello che l'utente vuole, e "Chiudi" resta il gesto
                   secondario che era. */
                <button
                  type="button"
                  onClick={() => {
                    scarta(toast.id);
                    toast.onRiprova?.();
                  }}
                  className="t-label tocco-esteso text-ink underline underline-offset-4"
                >
                  Riprova
                </button>
              )}
              <button
                type="button"
                onClick={() => scarta(toast.id)}
                className="t-label tocco-esteso text-ink-soft hover:text-ink"
              >
                Chiudi
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast va usato dentro <ToastProvider>.");
  }
  return context;
}
