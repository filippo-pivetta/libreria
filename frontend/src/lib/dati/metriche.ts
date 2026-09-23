import { cacheLife } from "next/cache";

import {
  getMetriche,
  getMetricheCollegato,
  type MetricheResult,
  type MetricheCollegatoResult,
} from "@/lib/api/metriche";
import { contesto } from "@/lib/dati/sessione";
import { DURATA_DATI_PERSONALI } from "@/lib/dati/durata";

/** Le proprie metriche. `anno` omesso: l'anno corrente in Europa
 * centrale, deciso dal backend — mai dedotto qui. */
export async function metricheMie(anno?: number): Promise<MetricheResult> {
  "use cache: private";
  cacheLife(DURATA_DATI_PERSONALI);
  const { accessToken, lingua } = await contesto();
  return getMetriche(accessToken, anno, lingua);
}

export async function metricheCollegato(
  utenteId: string,
  anno?: number,
): Promise<MetricheCollegatoResult> {
  "use cache: private";
  cacheLife(DURATA_DATI_PERSONALI);
  const { accessToken, lingua } = await contesto();
  return getMetricheCollegato(accessToken, utenteId, anno, lingua);
}
