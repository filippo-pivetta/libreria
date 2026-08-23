/* =============================================================================
 * Montaigne · risoluzione della lingua dell'interfaccia
 *
 * PRD: "interfaccia bilingue italiano e inglese dal primo giorno... date e
 * numeri seguono la lingua del browser" — nessun selettore (design-frontend.md
 * non ne descrive uno, §23 rimanda solo il perimetro della traduzione, non il
 * meccanismo). La lingua è quindi una funzione pura della stessa intestazione
 * `Accept-Language` che il browser manda da solo con ogni richiesta, calcolata
 * lato server a ogni richiesta — stesso stile di `lib/light.ts`, che calcola
 * la luce dall'ora invece di leggerla da un timer client: nessun cookie,
 * nessun `localStorage`, nessuno stato da tenere sincronizzato.
 *
 * Il backend risolve la stessa intestazione con lo stesso algoritmo
 * (`backend/app/core/lingua.py`): è ciò che tiene allineata la lingua in cui
 * next-intl mostra l'interfaccia con la lingua in cui il backend sceglie fra
 * le varianti di titolo/descrizione/etichetta di genere già salvate nelle due
 * lingue (design-frontend.md, entità Variante di titolo/Descrizione) — issue
 * #34, "Attenzione": una sola preferenza, non due che possono disallinearsi.
 * ========================================================================== */

export const LINGUE_INTERFACCIA = ["it", "en"] as const;

export type LinguaInterfaccia = (typeof LINGUE_INTERFACCIA)[number];

export const LINGUA_PREDEFINITA: LinguaInterfaccia = "it";

function èLinguaInterfaccia(codice: string): codice is LinguaInterfaccia {
  return (LINGUE_INTERFACCIA as readonly string[]).includes(codice);
}

/**
 * La prima lingua fra quelle richieste (in ordine di preferenza, `;q=`
 * incluso) che compare fra le due supportate; altrimenti l'italiano. Stesso
 * algoritmo di `backend/app/core/lingua.py::_lingua_da_intestazione` — le due
 * implementazioni vanno tenute allineate a mano, non condividono codice
 * perché vivono in runtime diversi.
 */
export function risolviLingua(acceptLanguage: string | null | undefined): LinguaInterfaccia {
  if (!acceptLanguage) return LINGUA_PREDEFINITA;

  const voci = acceptLanguage
    .split(",")
    .map((parte) => {
      const [tag, qParam] = parte.trim().split(";q=");
      const codice = (tag ?? "").trim().split("-")[0]?.toLowerCase() ?? "";
      // `qParam === undefined` e non un controllo di verità: `;q=` presente
      // ma vuoto (`"it;q=,en"`, di fatto malformato) deve valere qualità 0,
      // non 1 — altrimenti una stringa vuota, falsy quanto "assente", si
      // confonde con l'assenza di `;q=` e vince quando non dovrebbe. Stesso
      // esito di `backend/app/core/lingua.py`, dove `float("")` solleva e
      // ricade sullo stesso 0 — le due implementazioni vanno tenute
      // allineate anche su questo caso limite, non solo sul percorso comune.
      const qualita = qParam === undefined ? 1 : Number(qParam);
      return { codice, qualita: Number.isFinite(qualita) ? qualita : 0 };
    })
    .sort((a, b) => b.qualita - a.qualita);

  for (const { codice } of voci) {
    if (èLinguaInterfaccia(codice)) return codice;
  }
  return LINGUA_PREDEFINITA;
}

/**
 * Le intestazioni comuni di ogni fetcher di `lib/api/*.ts` verso il backend:
 * l'autenticazione, più `Accept-Language` quando il chiamante la passa
 * esplicitamente (i fetcher usati da un Server Component per il rendering
 * iniziale — vedi `lib/api/lingua-richiesta.ts`). Un fetch dal browser non
 * passa nulla qui: la manda già da sé, non richiede questo aiuto.
 */
export function intestazioniConLingua(
  accessToken: string,
  acceptLanguage?: string,
): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    ...(acceptLanguage ? { "Accept-Language": acceptLanguage } : {}),
  };
}
