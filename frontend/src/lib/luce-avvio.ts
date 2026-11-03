/**
 * Lo script della luce che gira prima del primo disegno.
 *
 * Non è importato da nessun modulo dell'app: `vite.config.ts` lo compila a
 * parte (IIFE minificata) e lo scrive inline nell'`<head>` di ogni pagina HTML.
 * Inline e non `<script src>`: un file esterno è una richiesta di rete in più
 * prima di poter disegnare, e senza di lui la prima pittura userebbe i colori
 * di fallback di `tokens.anchors.css` e la seconda quelli giusti — il lampo che
 * §3 esiste per evitare.
 */
import { applicaLuce } from "@/lib/luce-browser";

applicaLuce();
