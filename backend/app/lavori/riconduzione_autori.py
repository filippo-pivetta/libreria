"""Riconduzione autori oltre la corrispondenza esatta (issue #20, punto 3).

Il nucleo (`catalogo_repository._autore_id`) riconduce solo per
corrispondenza esatta su `autore_nome_variante.nome_variante`; quando non
trova un match crea SUBITO un nuovo autore, nel percorso critico di
POST /libri — è quel ramo che accoda questo lavoro. Qui si confrontano le
forme che nessuna normalizzazione avvicina ("J.R.R. Tolkien" / "John
Ronald Reuel Tolkien").

A differenza della deduplicazione libri (app/lavori/deduplicazione.py),
l'esecuzione qui PUÒ essere automatica quando il modello è confidente: il
raggio d'azione resta dentro il catalogo condiviso (autore,
autore_nome_variante, libro_autore), mai `voce_di_libreria`, ed è
comunque registrata e reversibile fuori banda tramite
`autore_riconduzione` (regola 22bis: un nome ricondotto a un'identità
esistente non deve creare un secondo autore nella metrica).
"""

import logging
from typing import Any

from fastapi.concurrency import run_in_threadpool

from app.cataloghi import llm
from app.cataloghi.errori import FonteNonRaggiungibileError
from app.core.testo import cognome
from app.lavori.errori import ErroreTransitorio
from app.repositories import catalogo_repository, database

logger = logging.getLogger("app.lavori.riconduzione_autori")

_MASSIMO_CANDIDATI = 20


async def esegui(payload: dict[str, Any]) -> None:
    autore_id = str(payload["autore_id"])
    nome_variante = str(payload.get("nome_variante") or "")
    cognome_nuovo = cognome(nome_variante)

    def _candidati() -> list[llm.CandidatoAutore]:
        with database.apri_connessione() as connessione:
            tutti = catalogo_repository.tutti_autori(connessione)
            corrispondenti = [
                (id_, nome)
                for id_, nome in tutti
                if id_ != autore_id and cognome_nuovo and cognome(nome) == cognome_nuovo
            ][:_MASSIMO_CANDIDATI]
            if not corrispondenti:
                return []
            varianti = catalogo_repository.varianti_di_autori(
                connessione, [id_ for id_, _ in corrispondenti]
            )
            return [
                llm.CandidatoAutore(
                    autore_id=id_, nome_canonico=nome, varianti=varianti.get(id_, [])
                )
                for id_, nome in corrispondenti
            ]

    candidati = await run_in_threadpool(_candidati)
    if not candidati:
        # Nessuna forma vicina esiste già: l'autore è davvero nuovo, non
        # vale la spesa di una chiamata al modello per confermarlo.
        return

    try:
        decisione = await llm.confronta_autori(nome_variante, candidati)
    except FonteNonRaggiungibileError as errore:
        raise ErroreTransitorio(errore.motivo) from errore

    if decisione is None:
        # Non confidente, o persone diverse: nessuna scrittura, nessuna
        # traccia per i quasi-match (decisione presa: restano fuori banda
        # finché non notati, invece di una coda di revisione dedicata).
        return

    validi = {c.autore_id for c in candidati}
    if decisione.autore_id_canonico not in validi:
        logger.warning(
            "Il modello ha restituito un autore_id_canonico fuori dai candidati per %s: %s",
            autore_id,
            decisione.autore_id_canonico,
        )
        return

    def _fondi() -> None:
        with database.apri_connessione() as connessione:
            catalogo_repository.fondi_autore(
                connessione,
                decisione.autore_id_canonico,
                autore_id,
                nome_variante,
                decisione.motivo,
            )

    await run_in_threadpool(_fondi)


async def su_fallimento(payload: dict[str, Any], errore: str) -> None:
    """Nessuna scrittura: l'autore duplicato resta a sé, esattamente lo
    stato pre-lavoro creato dal nucleo. Nessuna regressione — questo
    lavoro è un miglioramento opportunistico, non un passo obbligato."""
    logger.warning("Riconduzione autore %s non riuscita: %s", payload.get("autore_id"), errore)
