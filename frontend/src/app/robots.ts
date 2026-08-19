import type { MetadataRoute } from "next";

/**
 * Regola invalicabile 6 (docs/prd.md): nessuna pagina dell'app è
 * indicizzabile. Nessuna eccezione: l'intero sito è dietro autenticazione,
 * quindi non c'è nulla che valga la pena esporre a un crawler.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
