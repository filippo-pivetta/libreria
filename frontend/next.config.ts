import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Il link di invito di Supabase (docs/adr/0013) può reindirizzare su
  // 127.0.0.1 anche quando il dev server è raggiunto da "localhost": in
  // sviluppo Next.js blocca di default le richieste agli asset da
  // un'origine diversa da quella con cui è partito, il che 403-a tutti i
  // bundle JS e il websocket HMR senza toccare il rendering della pagina.
  allowedDevOrigins: ["127.0.0.1", "localhost"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Nessun sito terzo deve poter incorniciare l'app (clickjacking):
          // sia la direttiva CSP moderna sia l'header legacy per i browser
          // che non la leggono.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // Il service worker dell'app installata (public/sw.js) è l'unico
        // file che non deve MAI arrivare dalla cache: è il pezzo di codice
        // che decide cosa viene servito a tutti gli altri, e una sua copia
        // vecchia continuerebbe a servire un guscio vecchio finché qualcuno
        // non svuota la cache a mano — su un telefono, mesi. `no-store`
        // insieme a `updateViaCache: "none"` nella registrazione (vedi
        // src/components/layout/registra-service-worker.tsx) fa sì che una
        // versione nuova venga vista al primo avvio.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      {
        // Le icone dell'app cambiano solo se cambia il marchio, e il loro
        // nome resta lo stesso: per questo una settimana e non un anno, e
        // niente `immutable`. Con `immutable` un marchio nuovo resterebbe
        // invisibile per un anno su ogni telefono che ha già l'app
        // installata, senza alcun modo di forzarlo dal server.
        source: "/icone/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
