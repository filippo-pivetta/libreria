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

/** Esportata anche per «I titoli che tornano» (§13): stessa forma di
 * mensola, un solo ripiano invece di due. */
export function Mensola({ volumi }: { volumi: number }) {
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
 * La scheda del libro (§9). Rispecchia la forma vera di `Scheda`: tre
 * blocchi diretti della griglia, non due — segnalibro+giudizio, cos'è il
 * libro, e la storia — nello stesso ordine di markup, così su mobile si
 * stackano già nell'ordine giusto (la tua copia, poi il libro, poi la
 * storia) invece di quello che annidare la storia dentro il primo blocco
 * aveva rotto una volta. Uno scheletro che promette una forma diversa da
 * quella che arriva fa saltare la pagina invece di prepararla.
 */
export function ScheletroScheda() {
  return (
    <div aria-hidden className="flex flex-col">
      {/* Zona 1, testata: copertina accanto al titolo. */}
      <div className="grid grid-cols-[6.25rem_minmax(0,1fr)] items-start gap-4 border-b border-line pb-6 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-7 sm:pb-8">
        <Skeleton className="aspect-[2/3] w-full rounded-object" />
        <div className="flex flex-col gap-3 sm:pt-1">
          <Skeleton className="h-7 w-28 rounded-full" />
          <Skeleton className="h-9 w-4/5" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>

      <div className="mt-6 grid items-start gap-5 sm:mt-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-6">
        {/* Segnalibro + giudizio. */}
        <div className="flex flex-col gap-5 lg:col-start-1 lg:row-start-1">
          <div className="plane-1 grain p-5 sm:p-6">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-4 h-12 w-32" />
            <Skeleton className="mt-5 h-2.5 w-full rounded-full" />
            <Skeleton className="mt-3 h-3 w-48" />
            <Skeleton className="mt-5 h-11 w-44" />
          </div>
          <div className="plane-1 grain flex flex-col gap-5 p-5 sm:p-6">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-12 w-full rounded-field" />
          </div>
        </div>

        {/* Cos'è il libro: i fatti, poi l'abstract. Sticky su entrambe
            le righe, come l'aside vera. */}
        <div className="flex flex-col gap-5 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <div className="plane-1 grain flex flex-col gap-3 p-5">
            <Skeleton className="h-4 w-20" />
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
            <div className="mt-1 flex flex-wrap gap-1.5">
              {Array.from({ length: 2 }, (_, i) => (
                <Skeleton key={i} className="h-6 w-24 rounded-full" />
              ))}
            </div>
          </div>
          <div className="plane-1 grain flex flex-col gap-2.5 p-5">
            <Skeleton className="h-4 w-28" />
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-3.5 w-full" />
            ))}
          </div>
        </div>

        {/* La storia: terzo figlio diretto, non annidato nel primo — è
            quello che tiene l'ordine corretto anche mentre carica. */}
        <div className="flex flex-col gap-4 border-t border-line pt-6 lg:col-start-1 lg:row-start-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-16 w-full rounded-field" />
          <Skeleton className="h-16 w-full rounded-field" />
        </div>
      </div>
    </div>
  );
}

/** Un elenco di righe su una carta lunga: Lettori (§16), Profilo (§17). */
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
      {/* La carta prima: quattro numeri e la fascia dei mesi. Lo
          scheletro segue la forma vera, altrimenti il salto
          all'idratazione è un salto di layout. */}
      <div className="plane-1 grain p-6">
        <Skeleton className="h-2.5 w-24" />
        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5 sm:flex sm:gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="sm:flex-1">
              <Skeleton className="h-12 w-24" />
              <Skeleton className="mt-2 h-3 w-28" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-8 h-[141px] w-full" />
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
