import type { NextConfig } from "next";

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
    ];
  },
};

export default nextConfig;
