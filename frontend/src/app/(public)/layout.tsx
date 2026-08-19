/**
 * Chrome of the public area: no navigation, just the content. Hosts
 * `/login` and `/completa-account` — the two only entry points the PRD
 * allows: the instance stays invite-only (the Maintainer creates accounts
 * outside the app, docs/adr/0013), there's no open sign-up.
 *
 * Plane 0 with the lamp (design doc §3): every public page builds its
 * own composition on top — /login the full-page vertical split,
 * /completa-account a centered module — so this layout imposes neither
 * width nor centering.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="plane-0-lit min-h-screen">{children}</div>;
}
