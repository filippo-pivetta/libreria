import { RicercaSemantica } from "@/components/ricerca/ricerca-semantica";

export const metadata = { title: "Cerca nei tuoi insight" };

/**
 * Ricerca semantica (design doc §25, issue #6). Pagina a sé e non un
 * secondo campo sullo scaffale: §7 lo vieta esplicitamente — "non va
 * fusa nel campo sopra: revocare il consenso lascerebbe l'utente senza
 * il modo di trovare un libro". Il filtro dello scaffale cerca titoli e
 * autori e non chiama nessun modello; questo cerca dentro ciò che hai
 * scritto, e dipende dal consenso.
 *
 * Nessuna voce di menu: la navigazione ha quattro voci e §5 le tiene
 * tali. Ci si arriva dal collegamento accanto al filtro dello scaffale,
 * dove nasce il bisogno.
 */
export default function CercaPage() {
  return <RicercaSemantica />;
}
