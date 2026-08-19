"use client";

import { RouteError } from "@/components/states/route-error";

/**
 * Error boundary for the public area only (issue #11): replaces the
 * content of `(public)/layout.tsx` (plane 0 with the lamp stays mounted
 * above it), not the root layout.
 */
export default RouteError;
