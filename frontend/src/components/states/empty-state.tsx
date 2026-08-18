import type { ReactNode } from "react";

/**
 * Stato "nessun contenuto", riutilizzabile per qualunque lista o
 * collezione futura. Non presume nulla sul dominio: titolo e
 * descrizione arrivano da chi lo usa.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}
