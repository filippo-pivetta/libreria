import type { Metriche } from "@/lib/api/metriche";
import { formattaVoto } from "@/components/libro/voto-stelle";

/**
 * "Tu, nello stesso anno" sulla scheda Annali di un collegato.
 *
 * ---------------------------------------------------------------------
 * PERCHÉ NON È PIÙ UNA CARTA
 *
 * Prima erano due carte pari, affiancate, con dentro gli stessi numeri
 * nella stessa tipografia. Due carte pari affiancate *sono* un
 * confronto, e §15 lo vieta esplicitamente ("mai un confronto, niente
 * percentuali, niente 'hai letto più o meno di'"). Con quattro numeri e
 * un grafico per carta sarebbe diventato un confronto anche visivo: un
 * profilo mensile accanto a un altro profilo mensile è una gara, quali
 * che siano le parole intorno.
 *
 * I tuoi numeri restano, tutti e quattro, in una riga sola di terzo
 * peso sotto la sua carta. Rispondono alla domanda "e io?" senza
 * allestire una partita: nessuna percentuale, nessun "più" o "meno",
 * nessun grafico accanto a un grafico. Il grassetto sta sulle cifre e
 * non sulle etichette, così la riga si scandisce senza doverla leggere
 * per intero.
 *
 * Resta dentro la stanza del collegato, quindi grigia come tutto il
 * resto: mettere qui il tuo ottone romperebbe la metafora della lampada
 * di un altro (§15) per guadagnare un contrasto che non serve.
 * ---------------------------------------------------------------------
 */
export function RigaAffiancata({ metriche }: { metriche: Metriche }) {
  const { anno, libriFiniti, pagineLette, giorniConLettura, votoMedio } = metriche;

  return (
    <p className="t-meta mt-4 sm:px-6">
      Tu, nel {anno}: <span className="t-num text-ink">{libriFiniti}</span>{" "}
      {libriFiniti === 1 ? "libro finito" : "libri finiti"},{" "}
      <span className="t-num text-ink">{pagineLette.toLocaleString("it-IT")}</span> pagine,{" "}
      <span className="t-num text-ink">{giorniConLettura}</span>{" "}
      {giorniConLettura === 1 ? "giorno" : "giorni"} con lettura
      {votoMedio !== null && (
        <>
          , voto medio <span className="t-num text-ink">{formattaVoto(votoMedio)}</span>
        </>
      )}
      .
    </p>
  );
}
