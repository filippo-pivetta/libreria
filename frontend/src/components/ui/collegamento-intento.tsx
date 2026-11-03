import type { ComponentProps } from "react";

import { Link } from "@/components/ui/link";

/**
 * Un collegamento verso una destinazione fra molte (i dorsi dello scaffale, le
 * righe dei risultati, i lettori): precarica solo all'intenzione, mai al
 * montaggio. È `Link` senza `prefetch`, con un nome che dice perché: il
 * ragionamento sta in `components/ui/link.tsx`.
 */
export function CollegamentoIntento(props: Omit<ComponentProps<typeof Link>, "prefetch">) {
  return <Link {...props} />;
}
