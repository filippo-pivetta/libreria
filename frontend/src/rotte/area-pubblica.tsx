import { Outlet } from "react-router";

/**
 * Il guscio dell'area pubblica: nessuna navigazione, solo il contenuto. Ospita
 * `/login`, `/completa-account` e `/account-eliminato` — l'istanza resta a
 * invito (il Manutentore crea gli account fuori dall'app, docs/adr/0013), non
 * c'è registrazione aperta.
 *
 * Piano 0 con la lampada (design doc §3): ogni pagina pubblica costruisce sopra
 * la propria composizione, quindi qui non si impone né larghezza né centratura.
 */
export default function AreaPubblica() {
  return (
    <div className="plane-0-lit min-h-screen">
      <Outlet />
    </div>
  );
}
