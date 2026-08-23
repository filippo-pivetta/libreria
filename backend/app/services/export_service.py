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


def _ultima_lettura_conclusa(letture: list[dict[str, Any]]) -> dict[str, Any] | None:
    """La Lettura chiusa con esito "conclusa" più recente per data di
    fine: se la Voce è "letto" ce n'è sempre almeno una, ma non si
    solleva se per qualche motivo non ce ne fosse — i due campi restano
    vuoti invece di far fallire l'intera esportazione per una riga."""
    concluse = [
        lettura
        for lettura in letture
        if lettura.get("esito") == "conclusa" and lettura.get("data_fine")
    ]
    return max(concluse, key=lambda lettura: lettura["data_fine"], default=None)


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
