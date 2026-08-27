"""Da `opere.json` all'istruzione SQL che accoda la semina.

Perche' un generatore e non uno script che scrive nel database: accodare
1815 lavori e' un'operazione da fare una volta sola, in produzione, e
l'artefatto piu' sicuro per farla e' un file di testo che si legge prima
di eseguirlo. Nessuna connessione di produzione da maneggiare da qui,
nessun processo da tenere aperto: si incolla in SQL editor e il worker
che gia' gira fa il resto.

    python3 backend/dati/semina/genera_accodamento.py [secondi_fra_semine]
"""

import json
import pathlib
import sys

QUI = pathlib.Path(__file__).resolve().parent
RADICE = QUI.parents[2]
USCITA = RADICE / "supabase" / "manutenzione" / "semina" / "accoda_opere.sql"

PASSO_PREDEFINITO = 180
"""Secondi fra una semina e la successiva. 180 sono ~480 opere al giorno.

Il vincolo NON e' la coda, che ne smaltirebbe una al secondo: e' la quota
giornaliera di Google Books, che l'aggiunta di un libro consuma piu' di
una volta (ricerca piu' identificativi alternativi) e che le aggiunte
degli Utenti prendono dalla stessa chiave. Una semina che la esaurisce
non rallenta se stessa: fa fallire la ricerca a chi sta usando l'app.

Va tarato sulla quota reale del progetto, che si legge in Google Cloud
Console e non si puo' indovinare da qui.
"""


def sql_testo(valore: str) -> str:
    return "'" + valore.replace("'", "''") + "'"


def main() -> None:
    passo = int(sys.argv[1]) if len(sys.argv) > 1 else PASSO_PREDEFINITO
    opere = json.loads((QUI / "opere.json").read_text())

    righe = []
    for posizione, o in enumerate(opere, start=1):
        autori = ", ".join(sql_testo(a) for a in o["autori"]) or ""
        vettore = f"array[{autori}]::text[]" if autori else "array[]::text[]"
        righe.append(
            f"  ({posizione}, {sql_testo(o['ol_work'])}, {sql_testo(o['titolo'])}, {vettore})"
        )

    giorni = len(opere) * passo / 86400
    intestazione = f"""-- Accoda la semina del catalogo: {len(opere)} opere.
--
-- Generato da backend/dati/semina/genera_accodamento.py — non si modifica
-- a mano. La lista di partenza e' backend/dati/semina/opere.json, raccolta
-- da Open Library (vedi raccogli_da_open_library.py).
--
-- Si incolla in SQL editor una volta sola. Il worker che gia' gira in
-- produzione smaltisce la coda da solo: non serve avviare nulla.
--
-- RITMO: una semina ogni {passo} secondi, quindi ~{86400 // passo} al giorno e
-- circa {giorni:.1f} giorni per l'intera lista. Il vincolo e' la quota di
-- Google Books, condivisa con le ricerche degli Utenti — vedi il commento
-- di PASSO_PREDEFINITO nel generatore prima di stringere questo numero.
--
-- Le opere sono ordinate per numero di lettori su Open Library, quindi si
-- seminano dalle piu' lette: interrompere a meta' lascia comunque in
-- catalogo la parte che conta.
--
-- REVERSIBILE: `delete from public.lavoro where tipo = 'semina_libro' and
-- stato = 'in_attesa';` ferma tutto cio' che non e' ancora partito. Le
-- schede gia' nate restano, e sono schede normali.
--
-- RIENTRANTE: `on conflict do nothing` piu' l'indice unico parziale
-- `uq_lavoro_pendente (tipo, chiave)` fanno si' che rieseguire questo file
-- non accodi nulla due volte. La chiave e' l'identificativo d'opera di
-- Open Library.

with parametri as (select interval '{passo} seconds' as passo)
insert into public.lavoro (tipo, chiave, payload, esegui_dopo)
select
  'semina_libro',
  v.chiave,
  jsonb_build_object('titolo', v.titolo, 'autori', to_jsonb(v.autori), 'ol_work', v.chiave),
  now() + (v.posizione * p.passo)
from (values
"""
    coda = """
) as v (posizione, chiave, titolo, autori), parametri p
on conflict do nothing;
"""
    USCITA.write_text(intestazione + ",\n".join(righe) + coda)
    print(f"Scritto {USCITA.relative_to(RADICE)}: {len(opere)} opere, una ogni {passo}s")
    print(f"Durata stimata della semina: {giorni:.1f} giorni")


if __name__ == "__main__":
    main()
