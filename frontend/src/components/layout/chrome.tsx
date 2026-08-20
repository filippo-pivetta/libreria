"use client";

import { usePathname } from "next/navigation";

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

  return (
    <>
      <ProtectedNav userName={userName} receivedRequestCount={receivedRequestCount} />
      <main className="mx-auto w-full max-w-5xl flex-1 p-6 text-ink">{children}</main>
    </>
  );
}
