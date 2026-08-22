import { Suggerimenti } from "@/components/suggerimenti/suggerimenti";

export const metadata = { title: "Suggerimenti di lettura" };

/**
 * Suggerimenti di lettura (design doc §26, issue #27). Pagina a sé, come
 * `/cerca` e `/sintesi`: nessuna voce di menu, la navigazione ha quattro
 * voci e §5 le tiene tali. Ci si arriva dal collegamento accanto al
 * filtro dello scaffale.
 *
 * Nasce vuota per costruzione, come `/aggiungi`: effimeri, nessun dato
 * da idratare finché l'Utente non chiede un giro di suggerimenti.
 */
export default function SuggerimentiPage() {
  return (
    <div className="flex flex-col gap-8 py-4">
      <Suggerimenti />
    </div>
  );
}
