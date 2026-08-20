/**
 * Campo data (design doc §9, punto 4 — correzione del 20 agosto 2026):
 * "il campo data non è quello nativo con l'icona di sistema, è l'unico
 * elemento estraneo di tutta la pagina". Resta un `<input type="date">`
 * nativo (tastiera, validazione, selettore del sistema operativo su
 * mobile — tutto questo si perderebbe con un componente scritto da zero),
 * ma con `appearance: none` e l'indicatore nascosto, sulla sola riga
 * inferiore come ogni altro campo dell'app. Alternativa esplicitamente
 * ammessa dal documento al posto di un selettore costruito su Radix/
 * base-ui: quest'ultimo avrebbe richiesto una griglia di calendario
 * scritta a mano, non giustificata per un campo che serve solo a
 * correggere una data già scelta di default.
 */
export function CampoData({
  value,
  min,
  max,
  onChange,
  ariaLabel,
  id,
}: {
  value: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  id?: string;
}) {
  return (
    <input
      id={id}
      type="date"
      aria-label={ariaLabel}
      value={value}
      min={min}
      max={max}
      onChange={(event) => onChange(event.target.value)}
      className="field-date field-line h-8 w-[9.5rem] appearance-none border-0 border-b border-line bg-transparent px-0 font-ui text-sm text-ink outline-none placeholder:text-ink-soft"
    />
  );
}
