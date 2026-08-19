import type { CSSProperties } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { fontVariables } from "@/lib/fonts";
import { lightAttrs } from "@/lib/light";

export const metadata: Metadata = {
  title: "Montaigne",
  description: "Scaffold del progetto Montaigne.",
  // Non-negotiable rule 6 (docs/prd.md): no page is indexable. Reinforces
  // app/robots.ts at the per-page meta-tag level — the rule explicitly
  // calls for "checking the crawler-exclusion directives", plural.
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Compute the current light (design doc §3): always server-side, never
  // a timer in the browser, so two connected users see the same room at
  // the same hour and there's no hydration mismatch. No more .dark class
  // or theme: `data-light` carries the dominant anchor (needed by the few
  // selectors that must know whether the room is dark), `style` carries
  // the interpolated values that win over the fallback blocks in
  // tokens.anchors.css.
  const light = lightAttrs();
  const isNight = light["data-light"] === "notte";

  return (
    <html
      lang="it"
      data-light={light["data-light"]}
      className={fontVariables}
      style={{ ...light.style, colorScheme: isNight ? "dark" : "light" } as CSSProperties}
    >
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
