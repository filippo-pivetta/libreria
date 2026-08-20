import type { StatoVoce } from "@/lib/api/voci";

export type Ribbon = {
  colorClass: string;
  borderClass: string;
  textClass: string;
  lenVar: string;
  accessibileClass: string;
};

/**
 * Nastro per stato (design doc §7): "i colori dei nastri sono un
 * sistema a sé, indipendente dalla palette... restano uguali nei
 * quattro ancoraggi". "da leggere" non ha nastro — assenza, non colore.
 * Condiviso tra il dorso sullo scaffale, la scheda del libro ("nella
 * stessa posizione" in entrambi, §9: il libro che si apre non perde il
 * segnalibro) e i pulsanti di filtro per stato dello scaffale.
 */
export const RIBBON: Record<StatoVoce, Ribbon | null> = {
  da_leggere: null,
  in_lettura: {
    colorClass: "bg-ribbon-reading",
    borderClass: "border-ribbon-reading",
    textClass: "text-ribbon-reading",
    lenVar: "--ribbon-len-reading",
    // Il colore da solo non basta (rosso/verde indistinguibili per un
    // daltonico): "in lettura" porta anche un filo chiaro.
    accessibileClass: "ring-1 ring-inset ring-surface-2/70",
  },
  in_pausa: {
    colorClass: "bg-ribbon-paused",
    borderClass: "border-ribbon-paused",
    textClass: "text-ribbon-paused",
    lenVar: "--ribbon-len-paused",
    accessibileClass: "",
  },
  letto: {
    colorClass: "bg-ribbon-done",
    borderClass: "border-ribbon-done",
    textClass: "text-ribbon-done",
    lenVar: "--ribbon-len-done",
    accessibileClass: "",
  },
  abbandonato: {
    colorClass: "bg-ribbon-abandoned",
    borderClass: "border-ribbon-abandoned",
    textClass: "text-ribbon-abandoned",
    lenVar: "--ribbon-len-abandoned",
    accessibileClass: "",
  },
};
