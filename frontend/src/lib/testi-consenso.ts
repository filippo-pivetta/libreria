/**
 * I due testi lunghi del PRD, parola per parola.
 *
 * Il design doc §17 li dichiara intoccabili: "I due testi lunghi sono
 * quelli del PRD, parola per parola. L'avviso di visibilità è definito
 * come riga fissa, e il testo del consenso è dettato per intero perché è
 * la base di un consenso informato. Non vanno riscritti in forma più
 * breve o più simpatica."
 *
 * In un modulo a sé dall'issue #6, quando hanno smesso di servire in un
 * posto solo: compaiono al primo accesso (completamento dell'invito) e
 * nel profilo. Due copie a mano sarebbero diventate
 * due testi leggermente diversi alla prima correzione di una virgola —
 * su un testo che è la base di un consenso informato.
 */

export const AVVISO_VISIBILITA =
  "I tuoi collegati vedono la tua libreria, gli stati di lettura, gli avanzamenti, i voti, le metriche e, salvo che tu li renda privati, le tue recensioni e i tuoi insight. Le note restano sempre e solo tue.";

export const TESTO_CONSENSO =
  "Consenti l’elaborazione assistita. I testi che scrivi, insight e recensioni compresi, e le foto che carichi vengono inviati a OpenAI per generare consigli, sintesi e ricerche. Non vengono usati per addestrare modelli e restano nei loro sistemi fino a trenta giorni. Disattivando, queste funzioni si spengono e gli indici di ricerca costruiti sui tuoi testi vengono cancellati.";

/**
 * Non è testo del PRD ma una sua conseguenza diretta, che il design doc
 * chiede di mostrare sotto l'interruttore: "una riga sulle note di
 * intenzione: non escono mai, in nessuno stato del consenso. È
 * l'informazione più rassicurante della schermata."
 */
export const NOTE_FUORI_DAL_CONSENSO =
  "Le note di intenzione non escono mai da qui, qualunque cosa dica questo interruttore.";

/**
 * Cosa succede spegnendo, e cosa NON succede (design doc §17, regola 32
 * del PRD). Distinguere le due cose è il punto: senza, spegnere
 * sembrerebbe cancellare anche i pareri già salvati.
 *
 * Diceva anche "le cinque funzioni assistite si spengono e gli indici di
 * ricerca costruiti sui tuoi testi vengono cancellati", ed era un
 * doppione: è già l'ultima frase di `TESTO_CONSENSO`, che sta due righe
 * sopra nella stessa carta e che il PRD detta parola per parola. Restava
 * solo a far sembrare più lungo l'unico paragrafo che aggiungeva
 * qualcosa — e che è anche il più rassicurante dei due.
 */
export const EFFETTO_REVOCA =
  "Spegnendo, i pareri e le sintesi che hai già chiesto restano nella tua libreria: sono tuoi.";

export const EFFETTO_RIATTIVAZIONE =
  "Gli indici si ricostruiscono da capo. Finché non sono pronti la ricerca nei quaderni trova meno di quanto hai scritto, e te lo dice.";
