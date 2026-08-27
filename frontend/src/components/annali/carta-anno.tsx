import type { Metriche } from "@/lib/api/metriche";
import { AndamentoMensile } from "@/components/annali/andamento-mensile";
import { TitoloConChiosa } from "@/components/ui/chiosa";
import { formattaVoto } from "@/components/libro/voto-stelle";

/**
 * La carta prima degli Annali: l'anno in quattro numeri e una forma.
 *
 * ---------------------------------------------------------------------
 * PERCHÉ IL LIMITE NON STA PIÙ SOTTO OGNI NUMERO
 *
 * §14 prescrive che "ogni numero porta accanto il suo limite, in una
 * riga piccola, sempre". L'intento è giusto e resta. L'esecuzione no:
 * sotto "5.240" stavano diciotto parole di scuse, e misurato in
 * inchiostro il limite pesava più del dato che qualificava.
 *
 * Due cose distinte erano state fuse in una riga sola. L'UNITÀ ("pagine
 * lette", "di cui 2 riletture") dice cosa si sta guardando e resta
 * attaccata al numero, dove serve. Il LIMITE ("la somma non è mai
 * completa") è una proprietà del conteggio, non della cifra: scende in
 * fondo alla carta, sopra un filetto, detto una volta per tutta la
 * carta invece che tre volte.
 *
 * E soprattutto smette di essere perpetuo. "La somma non è mai completa"
 * era vero per costruzione e quindi non diceva nulla di questo anno;
 * `libriSenzaPagine` lo rende un fatto con un numero dentro, e quando
 * vale zero la frase sparisce perché la somma è davvero completa. Una
 * disclaimer che c'è sempre non si legge più dalla seconda visita; una
 * frase che nomina tre libri sì. È più onesto, non meno.
 *
 * Ultimo passo: il limite è entrato nella chiosa accanto al titolo
 * (`ui/chiosa.tsx`), perché cinque carte con cinque righe di prosa in
 * coda facevano di questa pagina metà numeri e metà note a piè di
 * pagina. Il punto interrogativo dice che c'è qualcosa da sapere; il
 * testo si legge quando serve saperlo.
 *
 * La chiosa di questa carta porta due cose, perché sono lo stesso
 * genere di limite sugli stessi numeri: lo scarto delle pagine e la
 * divergenza a cavallo d'anno, che prima era una riga sciolta in fondo
 * alla pagina senza una carta a cui appartenere.
 * ---------------------------------------------------------------------
 */
export function CartaAnno({
  metriche,
  /** Terza persona sulla scheda di un collegato: lì "hai segnato" e
   * "quest'anno" sarebbero falsi. Chi chiama lo sa, questa carta no. */
  altrui = false,
}: {
  metriche: Metriche;
  altrui?: boolean;
}) {
  const {
    anno,
    annoMassimo,
    libriFiniti,
    riletture,
    pagineLette,
    giorniConLettura,
    giorniTrascorsi,
    votoMedio,
    libriVotati,
    libriSenzaPagine,
    paginePerMese,
    haLettureACavalloAnno,
    lettureACavalloAnno,
  } = metriche;

  // "Quest'anno" solo quando l'anno mostrato è davvero quello corrente
  // (`annoMassimo`, che il backend fissa sempre lì): sfogliando un anno
  // passato la dicitura sarebbe falsa, mentre il numero resta vero.
  const titolo = altrui ? "Il suo anno" : anno === annoMassimo ? "Quest’anno" : String(anno);

  // "2 dei 2 libri finiti non hanno" è vero e suona come un errore di
  // battitura: quando lo scarto è totale la frase cambia soggetto invece
  // di ripetere lo stesso numero due volte.
  const soggetto =
    libriSenzaPagine === libriFiniti
      ? libriFiniti === 1
        ? "L’unico libro finito non ha"
        : `Nessuno dei ${libriFiniti} libri finiti ha`
      : libriSenzaPagine === 1
        ? `1 dei ${libriFiniti} libri finiti non ha`
        : `${libriSenzaPagine} dei ${libriFiniti} libri finiti non hanno`;

  const chiosa =
    libriSenzaPagine > 0 || haLettureACavalloAnno ? (
      <>
        {libriSenzaPagine > 0 && (
          <p>
            {soggetto} un totale di pagine: {libriSenzaPagine === 1 ? "" : "di quelli "}
            contano solo le pagine che {altrui ? "ha" : "hai"} segnato a mano, quindi{" "}
            {pagineLette.toLocaleString("it-IT")} è una somma per difetto.
          </p>
        )}
        {haLettureACavalloAnno && (
          <p>
            {lettureACavalloAnno === 1
              ? `Una lettura chiusa nel ${anno} era cominciata l’anno prima: conta come libro finito qui,`
              : `${lettureACavalloAnno} letture chiuse nel ${anno} erano cominciate l’anno prima: contano come libri finiti qui,`}{" "}
            mentre le {lettureACavalloAnno === 1 ? "sue" : "loro"} pagine restano divise fra i due
            anni secondo il giorno in cui sono state segnate.
          </p>
        )}
      </>
    ) : undefined;

  return (
    <div className="plane-1 grain rounded-card p-5 sm:p-6">
      <TitoloConChiosa titolo={titolo} chiosa={chiosa} />

      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5 sm:flex sm:gap-4">
        <Numero valore={String(libriFiniti)}>
          {libriFiniti === 1 ? "libro finito" : "libri finiti"}
          {riletture > 0 && (
            <>
              <br />
              di cui {riletture} {riletture === 1 ? "rilettura" : "riletture"}
            </>
          )}
        </Numero>

        <Numero valore={pagineLette.toLocaleString("it-IT")}>pagine lette</Numero>

        <Numero valore={String(giorniConLettura)}>
          {giorniConLettura === 1 ? "giorno con lettura" : "giorni con lettura"}
          <br />
          su {giorniTrascorsi} trascorsi
        </Numero>

        {/* Nessun voto nell'anno: la casella mostra quanti libri hanno un
            voto (cioè zero) invece di un trattino, che è un glifo e non
            un dato. Mai 0,0, che sarebbe un voto pessimo. */}
        {votoMedio === null ? (
          <Numero valore="0" tenue>
            libri votati
          </Numero>
        ) : (
          <Numero valore={formattaVoto(votoMedio)}>
            voto medio
            <br />
            su {libriVotati} {libriVotati === 1 ? "libro votato" : "libri votati"}
          </Numero>
        )}
      </div>

      <div className="mt-8">
        <AndamentoMensile paginePerMese={paginePerMese} giorniTrascorsi={giorniTrascorsi} />
      </div>

    </div>
  );
}

function Numero({
  valore,
  tenue = false,
  children,
}: {
  valore: string;
  /** Un valore che è un'assenza, non una misura: resta leggibile ma non
   * chiede l'attenzione che chiede un numero vero. */
  tenue?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="sm:flex-1">
      <p
        className={`t-num font-display text-[42px] leading-none sm:text-[52px] ${
          tenue ? "text-ink-soft" : "text-ink"
        }`}
        style={{ fontVariationSettings: '"opsz" 72, "SOFT" 12' }}
      >
        {valore}
      </p>
      <p className="t-meta mt-1.5">{children}</p>
    </div>
  );
}
