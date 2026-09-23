/**
 * Quanto a lungo un dato personale già letto resta buono senza tornare
 * al server.
 *
 * È il numero che separa una navigazione istantanea da una con lo
 * scheletro: senza, ogni ritorno su una pagina vista un minuto fa rifà
 * il giro completo verso il backend, e chi guarda rivede lo scheletro
 * per un dato che non è cambiato — quasi sempre perché l'ha scritto lui,
 * in questa stessa sessione.
 *
 * Coincide con lo `staleTime` di TanStack Query
 * (`providers/query-provider.tsx`) e per la stessa ragione, scritta lì:
 * «quasi tutto ciò che si legge lo ha scritto chi sta guardando, in
 * questa stessa sessione, e le mutazioni invalidano già le chiavi che
 * toccano». I due numeri vanno cambiati insieme: se uno dei due si
 * allontana, due parti della stessa schermata mostrano dati di età
 * diversa.
 *
 * **Dove vive questa cache.** Solo `"use cache: private"`, mai
 * `"use cache"` semplice: la variante privata non è **mai** conservata
 * sul server, sta nella memoria del browser di chi guarda e non
 * sopravvive a un ricaricamento. Un `"use cache"` normale finirebbe in
 * un archivio condiviso fra tutte le sessioni, con gli argomenti della
 * funzione come chiave — cioè la libreria di una persona in un posto che
 * un'altra può indicizzare. Su un'app dove ogni byte è personale, quella
 * direttiva non si usa: l'unica eccezione legittima è il catalogo, che
 * non appartiene a nessuno.
 */
export const DURATA_DATI_PERSONALI = {
  /** Per quanto il browser serve il dato senza chiedere niente. */
  stale: 300,
  /** Ogni quanto, dietro le quinte, vale la pena riprenderlo. */
  revalidate: 30,
  /** Oltre questo, si riparte dal server. */
  expire: 900,
} as const;
