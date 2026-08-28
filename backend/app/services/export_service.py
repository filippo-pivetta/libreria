"""Esportazione dei libri letti in CSV (issue #8, ADR 0011 rivisto): la
sola portabilità che il prodotto offre, limitata alle Voci con stato
"letto" e ai soli dati bibliografici, voto e recensione — mai insight né
nota di intenzione (PRD regola 34).
"""

import csv
import io
from typing import Any
from uuid import UUID

from fastapi.concurrency import run_in_threadpool

from app.core.supabase import get_user_client
from app.repositories import export_repository

_INTESTAZIONE = [
    "titolo",
    "autori",
    "generi",
    "anno_prima_pubblicazione",
    "lingua_originale",
    "pagine_adottate",
    "data_inizio_lettura",
    "data_fine_lettura",
    # L'annata, per le letture registrate a posteriori senza un giorno
    # (migrazione 20260827160000). Una colonna sua e non un valore
    # infilato in `data_fine_lettura`: un CSV che alterna "2019-03-12" e
    # "2019" nella stessa colonna non si apre con nessuno strumento.
    "anno_fine_lettura",
    "voto",
    "recensione",
]


def _titolo(libro: dict[str, Any], lingua: str) -> str:
    """Variante nella lingua dell'interfaccia (issue #34), altrimenti il
    titolo canonico (PRD, entità "Variante di titolo") — mai un titolo
    vuoto."""
    varianti = libro.get("variante_titolo") or []
    variante = next((v["titolo"] for v in varianti if v.get("lingua") == lingua), None)
    return str(variante or libro["titolo_canonico"])


def _autori(libro: dict[str, Any]) -> str:
    """Nell'ordine assegnato dal libro (regola 18 del PRD sul peso
    ripartito), joinati per la lettura umana di un file, non per essere
    riparsati."""
    righe = sorted(libro.get("libro_autore") or [], key=lambda r: r.get("ordine", 0))
    return "; ".join(r["autore"]["nome_canonico"] for r in righe if r.get("autore"))


def _generi(libro: dict[str, Any], lingua: str) -> str:
    etichette = []
    for riga in libro.get("libro_genere") or []:
        genere = riga.get("genere")
        if not genere:
            continue
        etichetta = next(
            (
                e["etichetta"]
                for e in genere.get("genere_etichetta", [])
                if e.get("lingua") == lingua
            ),
            None,
        )
        if etichetta:
            etichette.append(etichetta)
    return "; ".join(etichette)


def _chiave_ordinamento(lettura: dict[str, Any]) -> str:
    """La chiave con cui si sceglie la "più recente" fra letture di
    precisione diversa. Un'annata vale il 31 dicembre di quell'anno:
    è un ORDINE, non un dato — non viene scritto nel CSV, dove l'anno
    esce nella sua colonna e la data di fine resta vuota."""
    if lettura.get("data_fine"):
        return str(lettura["data_fine"])
    return f"{int(lettura['anno_fine']):04d}-12-31"


def _ultima_lettura_conclusa(letture: list[dict[str, Any]]) -> dict[str, Any] | None:
    """La Lettura chiusa con esito "conclusa" più recente: se la Voce è
    "letto" ce n'è sempre almeno una, ma non si solleva se per qualche
    motivo non ce ne fosse — i campi restano vuoti invece di far fallire
    l'intera esportazione per una riga.

    Una lettura registrata a posteriori con la sola annata entra qui come
    le altre; una senza alcuna data resta fuori dal confronto, perché non
    c'è nulla con cui ordinarla — se è l'unica, la riga esce con le tre
    colonne della lettura vuote, che è esattamente ciò che si sa."""
    concluse = [
        lettura
        for lettura in letture
        if lettura.get("esito") == "conclusa"
        and (lettura.get("data_fine") or lettura.get("anno_fine"))
    ]
    return max(concluse, key=_chiave_ordinamento, default=None)


def _recensione_testo(riga: dict[str, Any]) -> str:
    """`recensione` arriva come oggetto singolo o come lista a seconda di
    come PostgREST inferisce la relazione uno-a-uno: stessa cautela già
    presa da voce_repository._appiattisci_nota_intenzione per
    voce_di_libreria_privata."""
    recensione = riga.get("recensione")
    if isinstance(recensione, list):
        recensione = recensione[0] if recensione else None
    return recensione["testo"] if recensione else ""


def _riga_csv(riga: dict[str, Any], lingua: str) -> list[Any]:
    libro = riga["libro"]
    lettura = _ultima_lettura_conclusa(riga.get("letture") or [])
    return [
        _titolo(libro, lingua),
        _autori(libro),
        _generi(libro, lingua),
        libro.get("anno_prima_pubblicazione"),
        libro.get("lingua_originale"),
        riga.get("pagine_adottate"),
        lettura["data_inizio"] if lettura else None,
        lettura["data_fine"] if lettura else None,
        lettura.get("anno_fine") if lettura else None,
        riga.get("voto"),
        _recensione_testo(riga),
    ]


async def libri_letti_csv(access_token: str, utente_id: UUID, lingua: str) -> bytes:
    """CSV dei libri con stato "letto" dell'utente, ordinato per titolo.
    BOM UTF-8 in testa (`utf-8-sig`): senza, Excel apre il file
    interpretando gli accenti italiani con la codifica sbagliata invece
    di chiedere, il difetto più comune di un CSV non firmato. `lingua`
    (issue #34): titolo e generi seguono la stessa lingua dell'interfaccia
    di ogni altra funzione bibliografica, non più fissa a "it"."""
    client = get_user_client(access_token)
    righe = await run_in_threadpool(export_repository.list_libri_letti, client, utente_id)

    corpo = io.StringIO()
    scrittore = csv.writer(corpo)
    scrittore.writerow(_INTESTAZIONE)
    for riga in sorted(righe, key=lambda r: _titolo(r["libro"], lingua)):
        scrittore.writerow(_riga_csv(riga, lingua))

    return corpo.getvalue().encode("utf-8-sig")
