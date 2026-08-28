/**
 * Le icone dell'app, disegnate.
 *
 * Prima non esisteva un posto per le icone e ogni componente si
 * arrangiava con un glifo di testo: `⋯` per i menù, `▾` per "Altro",
 * `★`/`☆` per il voto. Tre problemi, non uno di gusto:
 *
 * 1. un glifo è testo, quindi cambia disegno, peso e larghezza a
 *    seconda del carattere che il sistema decide di usare per quel
 *    codepoint — su Android `⋯` e `▾` cadono spesso su un fallback che
 *    non ha niente a che vedere con Inter Tight;
 * 2. non si allinea a una griglia: `▾` era a corpo 9 per "sembrare"
 *    della misura giusta accanto a un testo di 12,5;
 * 3. una mezza stella con un carattere si può fare solo ritagliando in
 *    percentuale l'aletta piena sopra il contorno vuoto — che è
 *    esattamente ciò che `voto-stelle.tsx` faceva, e che con un tracciato
 *    si ottiene invece con un gradiente a due fermate.
 *
 * Tutte su griglia 24, contorno 1,5, `currentColor`, `size-4` di default
 * dal `[&_svg]` di `Button`. Nessuna emoji, in nessun caso: non sono
 * icone, sono contenuto, e il documento di design le ammette solo se
 * fanno parte del marchio — qui non ne fanno parte.
 */

type Props = React.SVGProps<SVGSVGElement>;

function Icona({ children, ...props }: Props & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconaPiu(props: Props) {
  return (
    <Icona strokeWidth={1.6} {...props}>
      <path d="M12 6.5v11M6.5 12h11" />
    </Icona>
  );
}

export function IconaLente(props: Props) {
  return (
    <Icona {...props}>
      <circle cx="10.75" cy="10.75" r="6.25" />
      <path d="m15.4 15.4 4.1 4.1" />
    </Icona>
  );
}

/** La croce di "svuota il campo". Griglia 24 come le altre, ma tracciata
 * corta: sta dentro un cerchio di 18px e a misura piena toccherebbe il
 * bordo. */
export function IconaChiudi(props: Props) {
  return (
    <Icona strokeWidth={1.7} {...props}>
      <path d="m8 8 8 8M16 8l-8 8" />
    </Icona>
  );
}

export function IconaFreccia(props: Props) {
  return (
    <Icona strokeWidth={1.6} {...props}>
      <path d="M6.5 9.75 12 15.25l5.5-5.5" />
    </Icona>
  );
}

export function IconaMatita(props: Props) {
  return (
    <Icona {...props}>
      <path d="M4 20h4L18 10a2.5 2.5 0 1 0-3.5-3.5L4.5 16.5z" />
    </Icona>
  );
}

export function IconaCalendario(props: Props) {
  return (
    <Icona {...props}>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3.5v4M16 3.5v4" />
    </Icona>
  );
}

export function IconaLibro(props: Props) {
  return (
    <Icona {...props}>
      <path d="M4 4.5h6a3 3 0 0 1 3 3v12a2.5 2.5 0 0 0-2.5-2.5H4z" />
      <path d="M20 4.5h-6a3 3 0 0 0-3 3v12a2.5 2.5 0 0 1 2.5-2.5H20z" />
    </Icona>
  );
}

/** Il menù di riga. Sostituisce il glifo `⋯`. */
/**
 * I tre puntini che aprono i menù (storico delle letture, insight, temi,
 * parere). È l'unica icona del gruppo fatta di PIENI invece che di
 * contorni, e non per capriccio.
 *
 * Era disegnata come tre tratti di lunghezza zero (`M6 12h.01`) chiusi
 * dal `stroke-linecap` tondo: il diametro del puntino era quindi il
 * contorno stesso, 1,9 su griglia 24, che a `size-4` — la misura che
 * `Button` dà alle icone — fa **1,27px** sullo schermo. Un TRATTO di
 * 1,27px si legge, perché è lungo; un DISCO di 1,27px no: l'antialiasing
 * lo spalma su due pixel a mezza opacità, e di un inchiostro che sta a
 * 6:1 su `surface-1` non resta quasi nulla. Il pulsante c'era, col suo
 * bersaglio da 32px e i 44px sotto il dito, ma non si vedeva.
 *
 * Con un raggio dichiarato il diametro smette di essere un effetto
 * collaterale del contorno: 1,75 su griglia 24 fa 2,33px a `size-4`, e
 * fra un puntino e l'altro restano 2,5 unità d'aria, quindi si leggono
 * ancora come tre e non come un trattino.
 */
export function IconaAltro(props: Props) {
  return (
    <Icona fill="currentColor" stroke="none" {...props}>
      <circle cx="6" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="18" cy="12" r="1.75" />
    </Icona>
  );
}

/** Privato: solo tuo, nessun collegato lo vede. */
export function IconaLucchetto(props: Props) {
  return (
    <Icona {...props}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5v-3a4 4 0 0 1 8 0v3" />
    </Icona>
  );
}

/** Condiviso con i collegati. */
export function IconaCollegati(props: Props) {
  return (
    <Icona {...props}>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M17 5.4a3.5 3.5 0 0 1 0 6.2M18.5 20a6.6 6.6 0 0 0-2-4.7" />
    </Icona>
  );
}

/** Spoiler: coperto per i collegati, in chiaro per te (design doc §11). */
export function IconaCoperto(props: Props) {
  return (
    <Icona {...props}>
      <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M4 20 20 4" />
    </Icona>
  );
}

/**
 * Una stella, riempita da 0 a 1. Il mezzo riempimento è un gradiente a
 * due fermate sullo stesso punto, non un ritaglio in percentuale:
 * l'`id` dev'essere unico nel documento, quindi lo porta chi chiama.
 */
export function IconaStella({
  riempimento,
  gradientId,
  ...props
}: Props & { riempimento: number; gradientId: string }) {
  const quota = Math.max(0, Math.min(1, riempimento));
  const tracciato = "M12 2.6l2.88 5.84 6.44.94-4.66 4.54 1.1 6.42L12 17.31l-5.76 3.03 1.1-6.42L2.68 9.38l6.44-.94z";

  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false" {...props}>
      {quota > 0 && quota < 1 && (
        <defs>
          <linearGradient id={gradientId}>
            <stop offset={`${quota * 100}%`} stopColor="currentColor" />
            <stop offset={`${quota * 100}%`} stopColor="transparent" />
          </linearGradient>
        </defs>
      )}
      {/* Il contorno sta SEMPRE sotto, anche a stella piena: è ciò che
          tiene la forma leggibile quando il riempimento è parziale. */}
      <path
        d={tracciato}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.3}
        strokeLinejoin="round"
        opacity={quota >= 1 ? 0 : 0.45}
      />
      {quota > 0 && (
        <path d={tracciato} fill={quota >= 1 ? "currentColor" : `url(#${gradientId})`} />
      )}
    </svg>
  );
}
