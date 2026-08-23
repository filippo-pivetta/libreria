/* =============================================================================
 * Montaigne · configurazione next-intl per la richiesta corrente
 *
 * Nessun segmento `[locale]` nell'URL: la lingua non è nella rotta né dietro
 * un selettore, è dedotta da `Accept-Language` a ogni richiesta (§ `lib/
 * lingua.ts`, che porta la spiegazione estesa). Questo file gira quindi
 * sempre in un Server Component: leggere `headers()` rende la richiesta
 * dinamica, ma il layout radice lo è già (legge il cookie della luce allo
 * stesso modo), quindi non è un costo nuovo.
 *
 * ---------------------------------------------------------------------------
 * `messages/it.json` e `messages/en.json` (issue #34)
 *
 * Sostituiscono `src/messaggi/it.ts`, il primo passo verso l'interfaccia
 * bilingue: le quattro categorie (errori, assenze, sessione, attesa) sono le
 * stesse chiavi, solo spostate in un catalogo per lingua invece che in un
 * oggetto TypeScript unico. Le regole di scrittura restano quelle di
 * design-frontend.md §19, applicate qui e valide per ENTRAMBE le lingue:
 *
 *   - mai "con successo", mai "per favore", nessun punto esclamativo,
 *     nessun "ops"; verbo prima nei comandi; un comando mantiene lo stesso
 *     nome per tutto il flusso;
 *   - un errore dice cosa è successo e cosa fare — "il soggetto è la cosa"
 *     ("La recensione non è stata salvata. Il testo è ancora qui."), mai un
 *     "non è stato possibile" impersonale e senza soggetto;
 *   - una sola voce per l'attesa in prima persona ("Ci penso…"/"Thinking…"),
 *     solo dove l'app sta davvero lavorando (quasi sempre il modello);
 *   - l'apostrofo è quello tipografico (’), mai quello dritto.
 *
 * Il resto delle stringhe dell'interfaccia (comandi, etichette, intestazioni
 * non ancora estratti) resta inline e in italiano — perimetro deliberato di
 * questa issue, non dimenticanza: vedi `docs/lavoro-rimandato.md`.
 * ========================================================================== */

import { headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { risolviLingua } from "@/lib/lingua";

export default getRequestConfig(async () => {
  const locale = risolviLingua((await headers()).get("accept-language"));
  return {
    locale,
    // Import dinamico, non i due cataloghi caricati insieme in testa al
    // file: una richiesta risolve una sola lingua, non ha motivo di
    // portarsi in bundle/in memoria anche il catalogo dell'altra — tanto
    // più che §23/#40 lo faranno crescere.
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
