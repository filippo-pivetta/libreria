import type { ReactNode } from "react";

/**
 * Generic "no content" state, reusable until a domain screen earns its
 * own treatment (design doc §18: the empty shelf, for instance, will get
 * its own hand-drawn ledge — not this panel). No alarm color: a quiet
 * invitation.
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
    <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line-strong py-16 text-center">
      <p className="font-ui text-sm font-medium text-ink">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-soft">{description}</p>}
      {action}
    </div>
  );
}
