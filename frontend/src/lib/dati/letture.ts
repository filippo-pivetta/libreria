import { cacheLife } from "next/cache";

import { getVoci, getVoceDettaglio, type VociResult, type VoceDettaglioResult } from "@/lib/api/voci";
import { contesto } from "@/lib/dati/sessione";
import { DURATA_DATI_PERSONALI } from "@/lib/dati/durata";

/**
 * La libreria e la scheda di un libro, per la richiesta corrente.
 *
 * Ogni funzione qui legge da sé sessione e lingua (vedi
 * `lib/dati/sessione.ts`) invece di riceverle: chiamarla due volte nella
 * stessa richiesta costa una sola andata di rete. È ciò che elimina le
 * duplicazioni che i layout e le pagine si portavano dietro — la scheda
 * di un libro chiedeva `GET /voci/{id}` sia dal layout, per decidere
 * quale barra mostrare, sia dalla pagina, per disegnarla.
 */

export async function vociMie(): Promise<VociResult> {
  "use cache: private";
  cacheLife(DURATA_DATI_PERSONALI);
  const { accessToken, lingua } = await contesto();
  return getVoci(accessToken, lingua);
}

export async function voceDettaglio(voceId: string): Promise<VoceDettaglioResult> {
  "use cache: private";
  cacheLife(DURATA_DATI_PERSONALI);
  const { accessToken, lingua } = await contesto();
  return getVoceDettaglio(accessToken, voceId, lingua);
}
