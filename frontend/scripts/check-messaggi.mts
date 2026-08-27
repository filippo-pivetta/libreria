/* =============================================================================
 * Il catalogo e il codice devono dire le stesse cose.
 *
 * Tre derive possibili, tutte già successe una volta in questo repo:
 *
 *   1. una chiave usata nel codice ma assente dal catalogo — `t()` non
 *      lancia: registra l'errore in console e stampa la chiave a schermo,
 *      quindi in produzione si vede "errori.imprevisto" al posto di una
 *      frase;
 *   2. una chiave nel catalogo che nessuno usa — sono state due
 *      (`attesa.cercoCataloghi`, `errori.collegamentiNonCaricati`), tenute
 *      tradotte in due lingue per mesi senza che comparissero mai;
 *   3. le due lingue che divergono — una chiave in italiano e non in
 *      inglese vuol dire, di nuovo, la chiave nuda a schermo.
 *
 * Le chiavi risolte a runtime (`regole.*` da un `error_code`, `accesso.*`
 * da `traduciErroreAuth`) non compaiono mai come letterali nel codice: si
 * verificano contro le sorgenti che le producono, non contro le `t()`.
 * ========================================================================== */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { componiMessaggio } from "../src/lib/messaggi-errore.js";

type Catalogo = Record<string, unknown>;

function piatte(d: Catalogo, p = ""): string[] {
  return Object.entries(d).flatMap(([k, v]) =>
    v && typeof v === "object" ? piatte(v as Catalogo, `${p}${k}.`) : [`${p}${k}`],
  );
}

function file(radice: string, filtro: RegExp): string[] {
  return readdirSync(radice).flatMap((nome) => {
    const percorso = join(radice, nome);
    if (statSync(percorso).isDirectory()) return file(percorso, filtro);
    return filtro.test(nome) ? [percorso] : [];
  });
}

type ErroreDiProva = { genere: string; codice?: string };

/** Lo stesso contratto che `useTranslations()` offre a `componiMessaggio`,
 * ma che alza invece di ripiegare: qui una chiave mancante deve fallire il
 * check, non finire a schermo come fa in produzione. */
function traduttore(lang: string) {
  const c = JSON.parse(readFileSync(`messages/${lang}.json`, "utf8"));
  const leggi = (k: string) =>
    k.split(".").reduce<unknown>(
      (o, p) =>
        o && typeof o === "object" && Object.prototype.hasOwnProperty.call(o, p)
          ? (o as Record<string, unknown>)[p]
          : undefined,
      c,
    );
  const t = ((k: string) => {
    const v = leggi(k);
    if (typeof v !== "string") throw new Error(`chiave nuda a schermo: ${k}`);
    return v;
  }) as ((k: string) => string) & { has(k: string): boolean };
  t.has = (k: string) => typeof leggi(k) === "string";
  return t;
}

const it = piatte(JSON.parse(readFileSync("messages/it.json", "utf8")));
const en = piatte(JSON.parse(readFileSync("messages/en.json", "utf8")));

const sorgenti = file("src", /\.tsx?$/).map((f) => readFileSync(f, "utf8")).join("\n");
const usate = new Set<string>();
const raccogli = (schema: RegExp, prefisso = "") => {
  for (const m of sorgenti.matchAll(schema)) usate.add(prefisso + m[1]);
};
raccogli(/\bt\("([a-zA-Z0-9_.]+)"\)/g);
raccogli(/\bspiega\(\s*"(\w+)"/g, "errori.");
raccogli(/\bavvisa\([^,]+,\s*"(\w+)"/g, "errori.");
raccogli(/\bmessaggioErrore\(\s*\n?\s*"(\w+)"/g, "errori.");
raccogli(/\bassenza\("(\w+)"\)/g, "assenze.");
raccogli(/\bregola\("(\w+)"\)/g, "regole.");
// `traduciErroreAuth` restituisce chiavi, non frasi: sono i suoi letterali
raccogli(/"(accesso\.\w+)"/g);

// Le sezioni che il traduttore compone da sé, o che si risolvono da un
// `error_code` del backend invece che da una chiamata scritta a mano.
const composte = (k: string) =>
  k.startsWith("rimedi.") || k.startsWith("rassicurazioni.") || k.startsWith("regole.");

const problemi: string[] = [];
for (const k of usate) if (!it.includes(k)) problemi.push(`usata ma assente dal catalogo: ${k}`);
for (const k of it) if (!en.includes(k)) problemi.push(`manca in inglese: ${k}`);
for (const k of en) if (!it.includes(k)) problemi.push(`manca in italiano: ${k}`);
for (const k of it) if (!usate.has(k) && !composte(k)) problemi.push(`nel catalogo ma inutilizzata: ${k}`);

// I `regole.*` si verificano contro i codici che il backend emette davvero.
const py = file("../backend/app", /\.py$/).map((f) => readFileSync(f, "utf8")).join("\n");
const codici = new Set<string>();
for (const m of py.matchAll(/"error_code":\s*"(\w+)"/g)) codici.add(m[1]);
for (const m of py.matchAll(/^\s+"MTG\d+":\s*"(\w+)",/gm)) codici.add(m[1]);
// Due codici non hanno una frase propria di proposito: la prima clausola la
// scrive il chiamante, che sa cosa non è arrivato (vedi ERRORE_MODELLO), e
// `fonte_irraggiungibile` è uno stato a sé, non un messaggio.
const senzaFrase = new Set(["modello_non_disponibile", "fonte_irraggiungibile"]);
for (const c of codici) {
  if (!senzaFrase.has(c) && !it.includes(`regole.${c}`)) {
    problemi.push(`error_code del backend senza frase in regole.*: ${c}`);
  }
}
// Una `regole.*` può nascere da due parti: da un `error_code` del backend,
// oppure da una validazione fatta nel client, che la nomina per esteso in un
// `t("regole.…")`. Il caso che resta — nessuna delle due — è una frase che
// nessuno può più far comparire.
for (const k of it) {
  if (!k.startsWith("regole.")) continue;
  const c = k.slice("regole.".length);
  if (!codici.has(c) && !usate.has(k)) {
    problemi.push(`regola che né il backend emette né il client nomina: ${c}`);
  }
}

// `ErroreApp.message` è "genere:codice" — esiste perché `Error` lo pretende
// e serve ai log, non a chi legge. Mostrarlo mette "server:HTTP 500" sotto un
// pulsante: è esattamente il difetto che questa architettura toglie di mezzo,
// e ci è rientrato due volte durante la migrazione stessa (in
// `ricerca-libri.tsx` e in `pagina-annali-collegato.tsx`), in entrambi i casi
// da un `.message` che nessun tipo poteva segnalare, perché `Error` ce l'ha.
const AMMESSI = ["src/lib/api/", "src/lib/errori-auth.ts", "src/providers/toast-provider.tsx"];
for (const f of file("src", /\.tsx?$/)) {
  if (AMMESSI.some((a) => f.replace(/\\/g, "/").startsWith(a))) continue;
  for (const riga of readFileSync(f, "utf8").split("\n")) {
    if (/^\s*[/*]/.test(riga)) continue; // commenti: parlano del difetto
    if (/\b\w+(\.\w+)*\.message\b/.test(riga)) {
      problemi.push(`\`.message\` di un Error mostrato invece della frase del catalogo: ${f} — ${riga.trim()}`);
    }
  }
}

// ---------------------------------------------------------------------------
// La composizione, provata sui cataloghi veri.
//
// Le verifiche sopra guardano le chiavi; questa guarda la frase che esce, che
// è la cosa che l'utente legge. Ha già ripreso una regressione: il controllo
// di forma sul `codice` accettava solo `snake_case`, quindi ogni
// `assenza("voceSparita")` — camelCase — veniva scartata e al posto di "Questo
// libro non è più nella tua libreria" usciva la composizione generica.
const attesi: [string, ErroreDiProva | undefined, string, string][] = [
  ["votoNonSalvato", { genere: "rete" }, "Il voto non è stato registrato. Controlla la connessione e riprova.", "The rating wasn’t recorded. Check your network and try again."],
  ["recensioneNonSalvata", { genere: "rete" }, "La recensione non è stata salvata. Il testo è ancora qui.", "The review wasn’t saved. Your text is still here."],
  ["statoNonCambiato", { genere: "assenza", codice: "voceSparita" }, "Questo libro non è più nella tua libreria.", "This book is no longer in your library."],
  ["statoNonCambiato", { genere: "regola", codice: "transizione_stato_non_ammessa" }, "Da questo stato quel passaggio non è ammesso.", "That step isn’t allowed from the book’s current status."],
  ["sintesiNonArrivata", { genere: "server", codice: "modello_non_disponibile" }, "La sintesi non è arrivata. Riprova fra poco.", "The synthesis didn’t arrive. Try again shortly."],
  ["votoNonSalvato", { genere: "sessione" }, "Il voto non è stato registrato. La sessione è scaduta: ricarica la pagina.", "The rating wasn’t recorded. Your session has expired: reload the page."],
  ["votoNonSalvato", undefined, "Il voto non è stato registrato. Riprova fra poco.", "The rating wasn’t recorded. Try again shortly."],
  // Un codice che il catalogo non conosce, e due che proverebbero a uscire
  // dalla propria sezione: nessuno dei tre deve far comparire una chiave nuda.
  ["libroNonAggiunto", { genere: "regola", codice: "codice_inventato" }, "Il libro non è stato aggiunto alla tua libreria. Riprova fra poco.", "The book wasn’t added to your library. Try again shortly."],
  ["libroNonAggiunto", { genere: "regola", codice: "__proto__" }, "Il libro non è stato aggiunto alla tua libreria. Riprova fra poco.", "The book wasn’t added to your library. Try again shortly."],
  ["libroNonAggiunto", { genere: "regola", codice: "assenze.voceSparita" }, "Il libro non è stato aggiunto alla tua libreria. Riprova fra poco.", "The book wasn’t added to your library. Try again shortly."],
];

for (const [dominio, errore, atteso_it, atteso_en] of attesi) {
  for (const [lang, atteso] of [["it", atteso_it], ["en", atteso_en]] as const) {
    let ottenuto: string;
    try {
      ottenuto = componiMessaggio(traduttore(lang), dominio as never, errore as never);
    } catch (e) {
      problemi.push(`composizione (${lang}) ${dominio}: ${(e as Error).message}`);
      continue;
    }
    if (ottenuto !== atteso) {
      problemi.push(`composizione (${lang}) ${dominio}:\n      atteso  "${atteso}"\n      ottenuto "${ottenuto}"`);
    }
  }
}

if (problemi.length > 0) {
  console.error(problemi.map((p) => `  ${p}`).join("\n"));
  process.exit(1);
}
console.log(
  `messaggi: ${it.length} chiavi, due lingue allineate, ${attesi.length * 2} frasi composte come attese.`,
);
