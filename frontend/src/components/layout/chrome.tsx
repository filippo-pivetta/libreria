"use client";

import { usePathname } from "next/navigation";

import { PortaProfilo } from "@/components/layout/porta-profilo";
import { ProtectedNav } from "@/components/layout/protected-nav";

/**
 * Sceglie fra la barra globale (casa tua) e nessuna barra qui (design
 * doc §5/§9/§15): nel contesto di un collegato — la sua libreria o un
 * suo libro — la barra globale sparisce del tutto, sostituita dalla
 * barra contestuale che i layout di `/lettori/[id]` e `/libro/[id]`
 * renderizzano a piena larghezza, prima di qualunque padding. Per
 * `/libro/[id]` questo vale anche per un libro TUO: quel layout non sa
 * ancora, a questo livello, se la voce è tua o di un collegato (serve un
 * fetch), quindi decide lui stesso se rimettere la barra globale o
 * sostituirla — qui basta togliersi di mezzo per entrambe le rotte.
 *
 * `usePathname`, non `params`: questo componente vive nel layout radice
 * dell'area protetta, che non riceve i parametri dinamici delle rotte
 * figlie — è l'unico modo per un layout condiviso di sapere in quale
 * ramo si trova.
 */
export function Chrome({
  userName,
  receivedRequestCount,
  children,
}: {
  userName: string;
  receivedRequestCount?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const haBarraPropria = pathname.startsWith("/lettori/") || pathname.startsWith("/libro/");

  if (haBarraPropria) {
    return <>{children}</>;
  }

  // Le quattro pagine che hanno già un vero titolo di pagina in cima
  // (Annali, Lettori, Profilo, Quaderni, tutte a `t-display` 44/56px): lì
  // la porta del profilo si appoggia in overlay sul loro angolo, a costo
  // di altezza zero, invece di prendersi una riga tutta sua sopra di
  // loro. La Libreria (`/`) non ha un titolo — «La tua libreria» è stato
  // tolto di proposito (design-frontend.md §7, la voce accesa in barra
  // lo dice già) — e resta l'unica eccezione priva di un angolo su cui
  // appoggiarsi: tiene ancora la riga dedicata qui sotto, in attesa di
  // una soluzione sua.
  const haTitoloProprio = ["/annals", "/readers", "/profilo", "/quaderni"].some(
    (rotta) => pathname === rotta || pathname.startsWith(`${rotta}/`),
  );

  return (
    <>
      <ProtectedNav userName={userName} receivedRequestCount={receivedRequestCount} />
      <main
        id="contenuto"
        className="sotto-la-barra relative mx-auto w-full max-w-5xl flex-1 px-4 py-3 text-ink sm:p-6"
      >
        {/* Sotto i 640px la barra in alto non esiste — la navigazione è in
            fondo — quindi la porta del profilo starebbe da nessuna parte.
            Sulle pagine con un titolo proprio galleggia in overlay
            sull'angolo in alto a destra, alla stessa quota del padding di
            `<main>`: non sposta il titolo di un pixel, perché non è nel
            flusso. Sulla Libreria, priva di titolo, resta la riga di
            prima: nessuna barra nuova da mantenere, ma qui l'altezza in
            più non ha ancora un angolo dove sparire. */}
        {haTitoloProprio ? (
          <div className="absolute right-4 top-3 sm:hidden">
            <PortaProfilo userName={userName} />
          </div>
        ) : (
          <div className="mb-1 flex justify-end sm:hidden">
            <PortaProfilo userName={userName} />
          </div>
        )}
        {children}
      </main>
    </>
  );
}
