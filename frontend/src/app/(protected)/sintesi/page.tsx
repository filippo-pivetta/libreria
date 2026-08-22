import { SintesiTematica } from "@/components/sintesi/sintesi-tematica";

export const metadata = { title: "Sintesi dei tuoi temi" };

/**
 * Sintesi tematica trasversale (design doc §27, issue #27). Pagina a sé,
 * come `/cerca` (§25): nessuna voce di menu, la navigazione ha quattro
 * voci e §5 le tiene tali. Ci si arriva dal collegamento accanto al
 * filtro dello scaffale, dove nasce il bisogno.
 *
 * Nessun fetch iniziale lato server, stessa filosofia di `/aggiungi`: il
 * componente client interroga `GET /sintesi-tematica` da sé e gestisce
 * anche lo stato "nessuna sintesi ancora generata".
 */
export default function SintesiPage() {
  return (
    <div className="flex flex-col gap-8 py-4">
      <SintesiTematica />
    </div>
  );
}
