"use client";

import { RouteError } from "@/components/states/route-error";

/**
 * Confine d'errore della sola area pubblica (issue #11): sostituisce il
 * contenuto di `(public)/layout.tsx` (legno e centratura restano
 * montati sopra), non il layout radice.
 */
export default RouteError;
