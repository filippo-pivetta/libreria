import { RicercaLibri } from "@/components/ricerca/ricerca-libri";
import { Suggerimenti } from "@/components/suggerimenti/suggerimenti";

export const metadata = { title: "Aggiungi un libro" };

/**
 * Ricerca e aggiunta di un libro dai cataloghi (design doc §13).
 *
 * A differenza di ogni altra pagina di `(protected)/`, qui il Server
 * Component non fa alcun fetch iniziale e non idrata `initialData`: senza
 * un termine non c'è nulla da caricare, e la sessione la verifica già il
 * layout. Non è una dimenticanza — è la sola pagina dell'app che nasce
 * vuota per costruzione.
 *
 * DUE CORSIE, dalla sessione UI di agosto 2026. Sopra il catalogo, per chi un
 * titolo ce l'ha già; sotto i suggerimenti di lettura, per chi non ce l'ha —
 * che erano una pagina orfana (`/suggerimenti`) raggiungibile solo da un
 * disclosure chiuso in mezzo ai filtri della Libreria. Il bisogno è lo stesso
 * e la pagina è quella dove nasce, quindi la seconda corsia sta qui invece di
 * avere una destinazione tutta sua che nessuno trovava. Un filetto separa i
 * due mestieri; il consenso lo controlla solo la seconda.
 */
export default function AggiungiPage() {
  return (
    <div className="flex flex-col gap-8 py-4">
      <RicercaLibri />
      <hr className="border-line" />
      <Suggerimenti />
    </div>
  );
}
