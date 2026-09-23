import { redirect } from "next/navigation";

import { me, collegamenti } from "@/lib/dati/profilo";
import { saluto } from "@/lib/saluto";

/**
 * I tre valori che la barra dell'area protetta prende dal server.
 *
 * Vive qui e non dentro un layout perché la vogliono in due: il layout
 * dell'area protetta e quello di `/libro/[id]`, che per un libro proprio
 * rimette la barra globale che `Chrome` aveva tolto.
 */
export type DatiBarra = {
  userName: string;
  /** Calcolato lato server (`lib/saluto.ts`): l'ora non si legge dal
   *  browser, stessa regola della luce (design-frontend.md §3). */
  saluto: string;
  receivedRequestCount?: number;
};

/**
 * Deliberatamente da **non** `await`-are nei layout: è la promessa che la
 * barra consuma dentro i propri confini di attesa. Aspettarla in un
 * layout significherebbe far aspettare anche il contenuto della pagina
 * per un nome e un contatore.
 *
 * Le due richieste non dipendono l'una dall'altra, quindi partono
 * insieme; e passando da `lib/dati` sono le stesse che il layout
 * dell'area protetta ha già chiesto, quindi di fatto una volta sola.
 */
export async function datiBarra(): Promise<DatiBarra> {
  const [profilo, relazioni] = await Promise.all([me(), collegamenti()]);

  if (profilo.status === "not_provisioned") {
    // Sessione valida ma account non ancora completato: capita a chi ha
    // chiuso la scheda a metà del completamento dell'invito
    // (docs/adr/0013) e torna più tardi navigando direttamente in
    // un'altra pagina. Non è un vicolo cieco — la via d'uscita è finire
    // quel passaggio.
    redirect("/completa-account");
  }

  // Un fallimento qui non toglie di mezzo la pagina: la barra resta
  // senza nome e senza contatore, e il contenuto — che ha i suoi fetch e
  // i suoi messaggi — si disegna lo stesso. Prima un `GET /me` fallito
  // sostituiva l'intera schermata con un errore di sessione, anche
  // quando la sessione era valida e a non rispondere era solo quella
  // rotta.
  const nomeUtente = profilo.status === "ok" ? profilo.data.nomeUtente : "";

  return {
    userName: nomeUtente,
    saluto: saluto(nomeUtente),
    receivedRequestCount:
      relazioni.status === "ok"
        ? relazioni.data.filter((c) => c.stato === "in_attesa" && !c.richiestoDaMe).length
        : undefined,
  };
}
