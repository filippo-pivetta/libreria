import { RicercaLibri } from "@/components/ricerca/ricerca-libri";
import { TitoliCheTornano } from "@/components/ricerca/titoli-che-tornano";
import { Suggerimenti } from "@/components/suggerimenti/suggerimenti";

export const metadata = { title: "Aggiungi un libro" };

/**
 * Ricerca e aggiunta di un libro dai cataloghi (design doc §13).
 *
 * A differenza di ogni altra pagina di `(protected)/`, qui il Server
 * Component non fa alcun fetch iniziale e non idrata `initialData`: senza
 * un termine non c'è nulla da caricare per il catalogo, e la sessione la
 * verifica già il layout. La terza corsia (sotto) non cambia questo: legge
 * la sua classifica per conto suo, in un client component a parte, così il
 * campo in cima resta comunque la prima cosa pronta.
 *
 * TRE CORSIE, un mestiere solo — trovare un libro nuovo — non tre funzioni
 * appiccicate (ridisegno del 25 agosto 2026, che ne ha aggiunta una terza
 * alle due della sessione UI precedente):
 *
 *   1. il campo, per chi un titolo ce l'ha già;
 *   2. «Se non hai un titolo in mente», il modello a partire dal proprio
 *      storico — erano i suggerimenti di lettura, una pagina orfana
 *      (`/suggerimenti`) raggiungibile solo da un disclosure chiuso in
 *      mezzo ai filtri della Libreria, prima di trasferirsi qui;
 *   3. «I titoli che tornano», il catalogo a partire da ciò che l'istanza
 *      legge davvero — nuova: prima la pagina restava vuota finché non si
 *      scriveva o non si chiedeva un consiglio, ora ha sempre qualcosa da
 *      offrire anche a campo intatto.
 *
 * Un filetto separa i tre mestieri; il consenso governa solo il secondo.
 * `<h1>` di pagina: prima non ce n'era uno, e con tre corsie serviva
 * qualcosa a tenerle insieme — la stessa misura di Quaderni e Lettori, non
 * un'invenzione locale (vedi anche `haTitoloProprio` in `layout/chrome.tsx`,
 * che le dà lo stesso trattamento).
 */
export default function AggiungiPage() {
  return (
    <div className="flex flex-col gap-8 py-4">
      <h1 className="t-display text-[44px] sm:text-[56px]">Aggiungi un libro</h1>
      <RicercaLibri />
      <hr className="border-line" />
      <Suggerimenti />
      <hr className="border-line" />
      <TitoliCheTornano />
    </div>
  );
}
