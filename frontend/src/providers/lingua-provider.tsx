import { IntlProvider } from "use-intl";

import { linguaDelBrowser } from "@/lib/lingua";
import it from "../../messages/it.json";
import en from "../../messages/en.json";

/**
 * La lingua dell'interfaccia (issue #34), risolta una volta all'avvio dalle
 * lingue del browser (`lib/lingua.ts`).
 *
 * I due cataloghi sono nel bundle tutti e due, e non caricati a richiesta: sono
 * pochi KB compressi, e un `import()` dinamico sarebbe una richiesta di rete in
 * più, in fila al bundle, prima di poter disegnare qualunque cosa.
 *
 * `timeZone` fisso su Roma: giorno, anno e "futuro" si valutano lì, mai nel
 * fuso del telefono (AGENTS.md).
 */
const lingua = linguaDelBrowser();
const CATALOGHI = { it, en } as const;

document.documentElement.lang = lingua;

export function LinguaProvider({ children }: { children: React.ReactNode }) {
  return (
    <IntlProvider locale={lingua} messages={CATALOGHI[lingua]} timeZone="Europe/Rome">
      {children}
    </IntlProvider>
  );
}
