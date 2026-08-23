/* =============================================================================
 * Montaigne · i messaggi dell'interfaccia, in italiano
 *
 * Prima passo verso l'interfaccia bilingue (issue #34): le stringhe escono dai
 * componenti e prendono una chiave stabile, senza ancora un framework di i18n
 * né una seconda lingua. Chi introdurrà `next-intl` troverà un catalogo già
 * fatto invece di 250 stringhe da rincorrere.
 *
 * ---------------------------------------------------------------------------
 * LE REGOLE DI SCRITTURA (design-frontend.md §19, applicate qui)
 *
 * Mai "con successo", mai "per favore", nessun punto esclamativo, nessun
 * "ops". Verbo prima nei comandi. Un comando mantiene lo stesso nome per tutto
 * il flusso.
 *
 * **Un errore dice cosa è successo e cosa fare.** Era la regola meno rispettata
 * di tutte: diciannove messaggi su quaranta cominciavano con "Non è stato
 * possibile" seguito da un infinito — impersonale, modale e infinito, tre
 * strati di distanza fra chi legge e il fatto, e nessuno dei due pezzi che la
 * regola chiede. Non dicevano cosa fosse successo (solo che qualcosa non era
 * riuscito) e quasi mai cosa fare.
 *
 * La forma adottata: **il soggetto è la cosa**, non un "non è stato possibile"
 * senza soggetto, e segue il passo successivo.
 *
 *     prima   "Non è stato possibile salvare la recensione."
 *     dopo    "La recensione non è stata salvata. Il testo è ancora qui."
 *
 * Dove il testo dell'Utente è ancora nel campo, il messaggio lo dice: è la
 * regola 25 del PRD ("un testo in corso di scrittura sopravvive alla scadenza
 * della sessione e a un errore di rete") resa visibile, ed è l'informazione
 * che più serve a chi ha appena scritto trecento parole.
 *
 * **Una voce sola per l'attesa.** Ce n'erano sette ("Caricamento…", "Carico
 * le metriche…", "Cerco temi…", "Ci penso…", "Un momento…", "Aggiungo…",
 * "Verifica dell'invito…"). Ora: la prima persona SOLO dove l'app sta
 * davvero lavorando per te, quasi sempre con il modello; altrove nessuna
 * etichetta, perché uno scheletro con la forma del contenuto (states/scheletri
 * .tsx) dice già cosa sta arrivando, e "Caricamento…" accanto a uno scaffale
 * disegnato è rumore.
 * ========================================================================== */

/** Scritture che non sono andate a buon fine. */
export const ERRORI = {
  votoNonSalvato: "Il voto non è stato registrato. Riprova.",
  recensioneNonSalvata: "La recensione non è stata salvata. Il testo è ancora qui.",
  recensioneNonCancellata: "La recensione non è stata cancellata. Riprova.",
  notaNonSalvata: "La nota non è stata salvata. Il testo è ancora qui.",
  insightNonSalvato: "L’insight non è stato salvato. Il testo è ancora qui.",
  insightNonCancellato: "L’insight non è stato cancellato. Riprova.",
  insightNonScoperto: "Il testo non è arrivato. Riprova.",
  statoNonCambiato: "Lo stato non è cambiato. Riprova.",
  pagineNonCorrette: "Il totale delle pagine non è stato aggiornato. Riprova.",
  pagineNonValide: "Scrivi un numero di pagine maggiore di zero.",
  letturaNonCancellata: "La lettura non è stata cancellata. Riprova.",
  voceNonCancellata: "La voce non è stata cancellata. Riprova.",
  libroNonAggiunto: "Il libro non è stato aggiunto alla tua libreria. Riprova.",
  consensoNonCambiato: "Il consenso non è cambiato. Riprova.",
  fileNonScaricato: "Il file non è stato scaricato. Riprova.",
  accountNonCancellato: "L’account non è stato cancellato. Riprova.",
  richiestaNonInviata: "La richiesta non è partita. Riprova.",
  richiestaNonAccettata: "La richiesta non è stata accettata. Riprova.",
  collegamentoNonAggiornato: "Il collegamento non è cambiato. Riprova.",
  parereNonCancellato: "Il parere non è stato cancellato. Riprova.",
  sintesiNonCancellata: "La sintesi non è stata cancellata. Riprova.",
  sintesiNonLetta: "La sintesi non è arrivata. Ricarica la pagina.",
  metricheNonCaricate: "Le metriche non sono arrivate. Ricarica la pagina.",
  metricheSueNonCaricate: "Le sue metriche non sono arrivate. Ricarica la pagina.",
  libreriaNonCaricata: "La libreria non è arrivata. Ricarica la pagina.",
  libroNonCaricato: "Il libro non è arrivato. Ricarica la pagina.",
  lettoriNonCaricati: "L’elenco dei lettori non è arrivato. Ricarica la pagina.",
  collegamentiNonCaricati: "I collegamenti non sono arrivati. Ricarica la pagina.",
  imprevisto: "Qualcosa si è rotto. Riprova, o torna alla pagina precedente.",
} as const;

/**
 * Righe che non sono errori: dicono che una cosa non c'è (più).
 *
 * "non esiste più" quando c'era e nel frattempo è sparita — tipicamente perché
 * qualcuno l'ha cancellata mentre la si guardava. "non esiste" per un
 * indirizzo sbagliato, dove non è mai esistito nulla. Prima le due forme si
 * mescolavano, e c'era anche un "Voce non trovata." che era una terza voce per
 * lo stesso fatto.
 */
export const ASSENZE = {
  voceSparita: "Questa voce non esiste più.",
  voceNonTua: "Questa voce non esiste, o non è tua.",
  letturaSparita: "Questa lettura non esiste più.",
  insightSparito: "Questo insight non esiste più.",
  libroSparito: "Questo libro non esiste più.",
  utenteSparito: "Questo utente non esiste più.",
  utenteInesistente: "Questo utente non esiste.",
  richiestaSparita: "Questa richiesta non esiste più.",
  collegamentoSparito: "Questo collegamento non esiste più.",
  libreriaChiusa: "Quella libreria non è più accessibile.",
  libreriaIrraggiungibile: "Questa libreria non è al momento raggiungibile.",
} as const;

/** Sessione e accesso. */
export const SESSIONE = {
  scaduta: "La sessione è scaduta. Ricarica la pagina.",
  scadutaInvito: "La sessione è scaduta. Chiedi un nuovo invito al Manutentore.",
  accountIncompleto: "Il tuo account non risulta completato.",
} as const;

/**
 * Attesa.
 *
 * `lavoro` è la prima persona, e vale solo dove l'app sta facendo qualcosa per
 * te che richiede tempo vero — quasi sempre una chiamata al modello. `attesa` è
 * la riga per i lettori di schermo accanto a uno scheletro: non descrive il
 * contenuto, perché lo scheletro ha già la sua forma.
 */
export const ATTESA = {
  generica: "Un momento…",
  penso: "Ci penso…",
  cercoTemi: "Cerco temi…",
  cercoCataloghi: "cerco nei cataloghi…",
  aggiungo: "Aggiungo…",
  controlloInvito: "Controllo l’invito…",
} as const;
