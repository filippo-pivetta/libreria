"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Toast = { id: number; message: string };

type ToastContextValue = {
  /** Un errore di scrittura (avanzamento, cambio di stato, correzione
   * pagine): compare come toast transitorio, mai come testo inline sotto
   * il campo. Deviazione esplicita da design-frontend.md §19 ("nessun
   * avviso che si sovrappone") e §6, decisa in corso d'opera — vedi la
   * nota nel documento accanto a quelle righe. Resta ferma la regola che
   * il rosso (`alert`) non compare mai su un errore: il toast è testo su
   * piano 2, non un riquadro d'allarme. */
  showError: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATA_MS = 6000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const contatore = useRef(0);
  const timer = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const rimuovi = useCallback((id: number) => {
    setToasts((precedenti) => precedenti.filter((toast) => toast.id !== id));
    const scaduto = timer.current.get(id);
    if (scaduto) {
      clearTimeout(scaduto);
      timer.current.delete(id);
    }
  }, []);

  const showError = useCallback(
    (message: string) => {
      const id = contatore.current++;
      setToasts((precedenti) => [...precedenti, { id, message }]);
      timer.current.set(
        id,
        setTimeout(() => rimuovi(id), DURATA_MS),
      );
    },
    [rimuovi],
  );

  return (
    <ToastContext.Provider value={{ showError }}>
      {children}
      {/* Fondo pagina, non centro schermo: uno stile "Notion", che non
      copre il pannello con cui si stava lavorando. aria-live assertive
      perché sono sempre errori — l'utente deve saperlo subito. */}
      <div
        aria-live="assertive"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="alert"
            className="plane-2 grain toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 px-4 py-3 text-sm text-ink"
          >
            <p className="flex-1 text-pretty">{toast.message}</p>
            <button
              type="button"
              onClick={() => rimuovi(toast.id)}
              aria-label="Chiudi"
              className="t-label shrink-0 text-ink-soft hover:text-ink"
            >
              Chiudi
            </button>
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
