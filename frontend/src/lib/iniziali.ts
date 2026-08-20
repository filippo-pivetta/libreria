/** Le prime due lettere di un nome utente, per il segnaposto rotondo
 * usato al posto di un'immagine profilo (design doc §16: "nessuna
 * immagine di profilo, che il PRD non prevede"). */
export function iniziali(nomeUtente: string): string {
  return nomeUtente.slice(0, 2).toUpperCase();
}
