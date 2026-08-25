"use client";

import { usePathname } from "next/navigation";

import { PortaProfilo } from "@/components/layout/porta-profilo";
import { ProtectedNav } from "@/components/layout/protected-nav";

/**
 * Sceglie quale barra mostrare (design doc §5/§9/§15, emendamento 25
 * agosto 2026).
 *
 * `/libro/[id]`: nessuna barra globale qui, sostituita per intero dalla
 * barra contestuale che quel layout renderizza a piena larghezza. Vale
 * anche per un libro TUO: quel layout non sa ancora, a questo livello,
 * se la voce è tua o di un collegato (serve un fetch), quindi decide lui
 * stesso se rimettere la barra globale o sostituirla — qui basta
 * togliersi di mezzo.
 *
 * `/lettori/[id]` (la libreria o gli annali di un collegato): la barra
 * globale RESTA, con "Lettori" accesa — su desktop in cima, su mobile in
 * fondo. Prima spariva del tutto e con lei il guscio dell'app: sotto i
 * 640px ci si trovava in una schermata senza fondo, con un solo modo di
 * uscire, in alto a sinistra. La stanza di un altro non è un'altra
 * applicazione: è una pagina dentro Lettori, e Lettori resta acceso
 * mentre la si guarda — la stessa regola che le HIG di Apple danno per
 * le tab bar, "non spariscono durante la navigazione". La barra
 * contestuale (`BarraContesto`, nel layout di quella cartella) diventa
 * quindi la testata DENTRO il contenuto, non una sostituta della barra
 * globale: qui si aggiunge `ProtectedNav`, senza il wrapper `<main>` di
 * sotto — quel layout porta già il proprio, a piena larghezza per la
 * testata e con padding per il resto.
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

  if (pathname.startsWith("/lettori/")) {
    return (
      <>
        <ProtectedNav userName={userName} receivedRequestCount={receivedRequestCount} />
        {children}
      </>
    );
  }

  if (pathname.startsWith("/libro/")) {
    return <>{children}</>;
  }

  // Le pagine che hanno già un vero titolo di pagina in cima (Annali,
  // Lettori, Profilo, Quaderni, e da quando ha tre corsie anche Aggiungi
  // un libro, tutte a `t-display` 44/56px): lì la porta del profilo si
  // appoggia in overlay sul loro angolo, a costo
  // di altezza zero, invece di prendersi una riga tutta sua sopra di
  // loro. La Libreria (`/`) non ha un titolo — «La tua libreria» è stato
  // tolto di proposito (design-frontend.md §7, la voce accesa in barra
  // lo dice già) — e resta l'unica eccezione priva di un angolo su cui
  // appoggiarsi: tiene ancora la riga dedicata qui sotto, in attesa di
  // una soluzione sua.
  //
  // Un titolo gliene darebbe uno, e per un giorno (25 agosto 2026) è
  // stato il conteggio dei volumi. Non è la soluzione: un totale è una
  // misura del contenuto, non il contenuto, e a corpo 56 gridava un dato
  // che nessuno stava cercando. Meglio l'eccezione di un titolo finto —
  // e comunque questa riga costa 22px una volta sola, in cima.
  const haTitoloProprio = ["/annals", "/readers", "/profilo", "/quaderni", "/aggiungi"].some(
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
