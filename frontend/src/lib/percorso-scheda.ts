import type { Risultato } from "@/lib/api/ricerca";

/**
 * Dove porta il titolo di una riga di risultato: la scheda del libro
 * guardato prima di averlo (design doc §13).
 *
 * Un risultato esterno i cui identificativi sono già noti al catalogo va
 * alla carta della SCHEDA e non a quella del volume: stessi dati che si
 * vedrebbero dopo l'aggiunta, e un indirizzo stabile invece di uno legato
 * a un identificativo di edizione. Il back end farebbe comunque lo stesso
 * dirottamento, ma un indirizzo che cambia identità sotto i piedi è
 * un'altra cosa da uno che nasce giusto.
 *
 * `alt` porta le altre edizioni della stessa opera solo quando si arriva
 * da una riga che le conosceva: servono all'aggiunta (più ISBN in mano,
 * più probabilità che l'identità dell'opera si chiuda), mai a mostrare la
 * carta. Un link copiato senza di esse funziona lo stesso.
 */
export function percorsoScheda(risultato: Risultato): string {
  if (risultato.origine === "locale" || risultato.libroId !== null) {
    const libroId = risultato.origine === "locale" ? risultato.libroId : risultato.libroId;
    return `/book/catalogo/${libroId}`;
  }

  const alternativi = risultato.volumiAlternativi.join(",");
  const query = alternativi ? `?alt=${encodeURIComponent(alternativi)}` : "";
  return `/book/google/${encodeURIComponent(risultato.volumeId)}${query}`;
}
