import { Skeleton } from "@/components/ui/skeleton";

/**
 * Scheletri con la forma di ciò che sta arrivando.
 *
 * `LoadingState` mostra tre barre uguali per qualunque schermata: dice "sto
 * caricando", non dice "sta arrivando uno scaffale". La differenza si sente
 * nel momento in cui i dati atterrano — con uno scheletro della forma giusta
 * il contenuto prende il posto che occupava già, senza che la pagina salti.
 *
 * Regola per chi ne aggiunge uno: deve avere le stesse misure del contenuto
 * vero, prese dagli stessi token (`--cover-w`, `--shelf-height`), mai numeri
 * scelti a occhio — altrimenti il salto lo introduce lo scheletro stesso.
 * Nessuno di questi porta testo: l'etichetta per i lettori di schermo la mette
 * chi li usa, una sola volta, sul contenitore.
 */

function Copertina() {
  return (
    <div className="flex items-stretch">
      <Skeleton className="w-3 rounded-l-object rounded-r-none" />
      <Skeleton
        className="rounded-l-none rounded-r-object"
        style={{ width: "var(--cover-w)", height: "var(--cover-h)" }}
      />
    </div>
  );
}

function Mensola({ volumi }: { volumi: number }) {
  return (
    <div className="flex flex-col gap-0">
      <div className="flex flex-wrap items-end gap-3 pb-3">
        {Array.from({ length: volumi }, (_, i) => (
          <Copertina key={i} />
        ))}
      </div>
      {/* La mensola vera, non uno scheletro: è una barra piena di suo, e
          farla pulsare la trasformerebbe in un dato in attesa che non è. */}
      <div className="shelf-board" />
    </div>
  );
}

/** La Libreria (§7): riga dei filtri, fascia delle letture in corso, mensole. */
export function ScheletroScaffale() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <Skeleton className="h-8 w-full max-w-sm" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-6 w-20 rounded-full" />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-10">
        <Mensola volumi={3} />
        <Mensola volumi={5} />
      </div>
    </div>
  );
}

/**
 * La scheda del libro (§9): due pagine, impilate sotto i 768px e affiancate
 * sopra, separate dal vuoto di 2px che è la piega.
 */
export function ScheletroScheda() {
  return (
    <div aria-hidden className="flex flex-col gap-0.5 md:flex-row">
      <div className="plane-1 pagina-opera grain flex-1 p-6">
        <Skeleton className="mb-4 h-48 w-32 rounded-object" />
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="mt-2 h-4 w-1/2" />
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 border-b border-line pb-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-6 w-24 rounded-object" />
          ))}
        </div>
        <Skeleton className="mt-4 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-2/3" />
      </div>
      <div className="plane-1 pagina-copia grain flex-1 p-6">
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="mt-5 h-1.5 w-full rounded-object" />
        <Skeleton className="mt-2 h-3 w-40" />
        <div className="mt-6 flex flex-wrap gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-24" />
        </div>
        <Skeleton className="mt-6 h-5 w-32" />
        <Skeleton className="mt-6 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-5/6" />
      </div>
    </div>
  );
}

/** Un elenco di righe su una carta lunga: Lettori (§16), Torre (§17). */
export function ScheletroElenco({ righe = 4 }: { righe?: number }) {
  return (
    <div aria-hidden className="plane-1 grain flex flex-col">
      {Array.from({ length: righe }, (_, i) => (
        <div
          key={i}
          className={`flex items-center gap-3 p-4 ${i > 0 ? "border-t border-line" : ""}`}
        >
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-40" />
        </div>
      ))}
    </div>
  );
}

/** Gli Annali (§14): una griglia di carte di metrica, nessuna sollevata. */
export function ScheletroAnnali() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-8 w-36" />
      </div>
      <div className="plane-1 grain p-6">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="mt-3 h-10 w-28" />
        <Skeleton className="mt-2 h-3 w-56" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="plane-1 grain p-6">
            <Skeleton className="h-2.5 w-32" />
            <div className="mt-4 flex flex-col gap-3">
              {Array.from({ length: 5 }, (_, r) => (
                <Skeleton key={r} className="h-4 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
