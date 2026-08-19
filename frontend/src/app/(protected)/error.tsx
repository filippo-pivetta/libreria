"use client";

import { RouteError } from "@/components/states/route-error";

/**
 * Confine d'errore della sola area protetta (issue #11): sostituisce
 * solo il contenuto di `main` in `(protected)/layout.tsx` — la
 * navigazione (nome utente, "Esci") resta montata sopra.
 */
export default RouteError;
