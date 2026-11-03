import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { build as esbuild } from "esbuild";
import { defineConfig, loadEnv, type Plugin } from "vite";

const radice = fileURLToPath(new URL(".", import.meta.url));
const sorgenti = fileURLToPath(new URL("./src", import.meta.url));

const VARIABILI_OBBLIGATORIE = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY", "VITE_API_BASE_URL"];

/* Impressa nel build e confrontata a runtime con `/version.json`: l'app
   installata può riprendere dalla memoria per giorni senza mai rinavigare, e
   senza questo confronto resterebbe su un deploy vecchio
   (`components/layout/registra-service-worker.tsx`). */
const versione = process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";
process.env.VITE_APP_VERSION = versione;

function fileVersione(): Plugin {
  return {
    name: "montaigne:versione",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ version: versione }),
      });
    },
  };
}

/**
 * Lo script della luce, inline in cima all'`<head>` di ogni pagina HTML.
 *
 * Compilato a parte con esbuild da `src/lib/luce-avvio.ts` (che riusa
 * `lib/light.ts` tale e quale) in una IIFE minificata: deve girare prima del
 * primo disegno, quindi non può aspettare né il bundle dell'app né una
 * richiesta di rete in più. In sviluppo si ricompila a ogni richiesta della
 * pagina, così una modifica a `light.ts` si vede ricaricando.
 */
function luceInline(): Plugin {
  let inCache: string | undefined;
  let produzione = false;

  async function compila(): Promise<string> {
    const esito = await esbuild({
      entryPoints: [`${sorgenti}/lib/luce-avvio.ts`],
      bundle: true,
      minify: true,
      format: "iife",
      target: "es2020",
      write: false,
      alias: { "@": sorgenti },
    });
    return esito.outputFiles[0].text.trim();
  }

  return {
    name: "montaigne:luce-inline",
    configResolved(config) {
      produzione = config.command === "build";
    },
    async transformIndexHtml() {
      const codice = produzione ? (inCache ??= await compila()) : await compila();
      return [{ tag: "script", children: codice, injectTo: "head-prepend" }];
    },
  };
}

/**
 * I testi delle pagine HTML scritte a mano (`senza-rete.html`), presi dai
 * cataloghi: `%it:senzaRete.titolo%` diventa la frase italiana, `%en:…%`
 * quella inglese. Così anche quella pagina ha una sorgente sola per le sue
 * parole, e `npm run check:messaggi` le vede usate.
 */
function testiDalCatalogo(): Plugin {
  const catalogo = (lingua: string) =>
    JSON.parse(readFileSync(`${radice}/messages/${lingua}.json`, "utf8")) as Record<string, unknown>;
  const leggi = (oggetto: Record<string, unknown>, chiave: string): string => {
    const valore = chiave
      .split(".")
      .reduce<unknown>((o, parte) => (o as Record<string, unknown> | undefined)?.[parte], oggetto);
    if (typeof valore !== "string") throw new Error(`Chiave assente dal catalogo: ${chiave}`);
    return valore.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  };

  return {
    name: "montaigne:testi-dal-catalogo",
    transformIndexHtml(html) {
      const cataloghi: Record<string, Record<string, unknown>> = { it: catalogo("it"), en: catalogo("en") };
      return html.replace(/%(it|en):([a-zA-Z0-9_.]+)%/g, (_, lingua: string, chiave: string) =>
        leggi(cataloghi[lingua], chiave),
      );
    },
  };
}

export default defineConfig(({ command, mode }) => {
  if (command === "build") {
    const env = loadEnv(mode, radice, "VITE_");
    const mancanti = VARIABILI_OBBLIGATORIE.filter((nome) => !env[nome]);
    if (mancanti.length > 0) {
      throw new Error(`Variabili d'ambiente mancanti: ${mancanti.join(", ")}`);
    }
  }

  return {
    plugins: [react(), tailwindcss(), luceInline(), testiDalCatalogo(), fileVersione()],
    resolve: { alias: { "@": sorgenti } },
    // La stessa porta di Next: il CORS del backend e gli URL di ritorno di
    // Supabase locale (`supabase/config.toml`) la aspettano già.
    server: { port: 3000, strictPort: true },
    preview: { port: 3000, strictPort: true },
    build: {
      rollupOptions: {
        input: {
          app: `${radice}/index.html`,
          "senza-rete": `${radice}/senza-rete.html`,
        },
      },
    },
  };
});
