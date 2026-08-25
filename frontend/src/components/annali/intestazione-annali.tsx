import { TestataPagina } from "@/components/layout/testata-pagina";
import { SelettoreAnno } from "@/components/annali/selettore-anno";

/**
 * L'intestazione degli Annali, propria o di un collegato.
 *
 * Il titolo di pagina era "Annali", cioè la stessa parola che sta accesa
 * nella barra di navigazione due righe più sopra: un titolo che ripete
 * l'indirizzo invece di nominare il contenuto. Il contenuto di questa
 * pagina è un anno, quindi il titolo è l'anno.
 *
 * ---------------------------------------------------------------------
 * SULLA PAGINA DI UN COLLEGATO
 *
 * Proprio perché il titolo è diventato l'anno, sulla sua pagina sarebbe
 * identico alla tua: un "2026" in Fraunces non dice di chi è. Sopra
 * l'anno compare allora una micro-etichetta che sulla propria pagina non
 * esiste mai, "ANNALI DI MARTA", che è esattamente il mestiere di
 * `.t-label` (§4: "solo micro-etichetta sopra un dato").
 *
 * L'occhiello ora c'è SEMPRE, non solo sulla pagina di un collegato: era
 * l'unica delle due versioni ad avere un nome, e un titolo che è un nudo
 * "2026" non dice di quale sezione sia il titolo. È anche ciò che ha
 * permesso di togliere il sottotitolo (sotto): la parola la dà
 * l'occhiello, la specificità la dà il numero.
 *
 * È il terzo segnale di quattro, e l'unico in parole. Gli altri
 * arrivano dal contesto e non da qui: la barra globale sparisce del
 * tutto e al suo posto c'è "‹ Lettori" con nome e iniziali (§15), e
 * `[data-guest]` raffredda la stanza portando `accent` e `accent-strong`
 * a `ink-soft`, quindi barre e ciambella diventano grigie. Il quarto è
 * la terza persona nelle carte ("come li HA votati").
 * ---------------------------------------------------------------------
 *
 * La riga sotto l'anno diceva "Anno in corso. Ogni numero è ricalcolato
 * adesso.": un fatto vero per costruzione (ADR 0004, ogni metrica è
 * ricalcolata a ogni richiesta) ripetuto a ogni visita, quindi mai
 * informativo — lo stesso principio per cui, poco sopra in questo
 * stesso file, "la somma non è mai completa" è stato sostituito da
 * `libri_senza_pagine`: un promemoria perenne smette di leggersi dalla
 * seconda visita. Le è succeduta "L'anno raccontato dai numeri.", che è
 * caduta per la stessa ragione un passo più in là: non spiegava un
 * meccanismo, ma non diceva nulla che la pagina non mostrasse già —
 * l'insegna di sé stessa, cioè il riempitivo che il §19 vieta. Un
 * sottotitolo resta solo dove dichiara un confine che la pagina non può
 * mostrare, come quello dei Quaderni sulla visibilità dei testi.
 */
export function IntestazioneAnnali({
  anno,
  annoMinimo,
  annoMassimo,
  onCambiaAnno,
  /** Presente solo nel contesto di un collegato: la sua presenza è il
   * segnale, non il suo valore. */
  nomeUtente,
}: {
  anno: number;
  annoMinimo: number;
  annoMassimo: number;
  onCambiaAnno: (anno: number) => void;
  nomeUtente?: string;
}) {
  return (
    <TestataPagina
      titolo={String(anno)}
      titoloBarra="Annali"
      occhiello={nomeUtente ? `Annali di ${nomeUtente}` : "Annali"}
      numero
    >
      <SelettoreAnno
        anno={anno}
        annoMinimo={annoMinimo}
        annoMassimo={annoMassimo}
        onCambiaAnno={onCambiaAnno}
      />
    </TestataPagina>
  );
}
