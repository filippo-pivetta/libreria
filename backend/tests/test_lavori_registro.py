"""Il dizionario dei gestori (app/lavori/registro.py): verifica che i tre
nuovi tipi dell'issue #20 siano registrati e puntino alle funzioni giuste
— lo stesso dizionario che `chk_lavoro_tipo` (migrazione
20260821180000) rende l'unico elenco ammesso."""

from app.lavori import (
    arricchimento_bibliografico,
    copertine,
    deduplicazione,
    descrizioni,
    standardizzazione_descrizione,
)
from app.lavori import riconduzione_autori as riconduzione_autori_modulo
from app.lavori.registro import GESTORI


def test_tutti_i_tipi_attesi_sono_registrati() -> None:
    assert set(GESTORI) == {
        "copertina",
        "descrizione",
        "arricchimento_bibliografico",
        "riconduzione_autore",
        "deduplicazione_libro",
        "standardizzazione_descrizione",
    }


def test_ogni_gestore_punta_al_modulo_giusto() -> None:
    assert GESTORI["copertina"].esegui is copertine.esegui
    assert GESTORI["descrizione"].esegui is descrizioni.esegui
    assert GESTORI["arricchimento_bibliografico"].esegui is arricchimento_bibliografico.esegui
    assert GESTORI["riconduzione_autore"].esegui is riconduzione_autori_modulo.esegui
    assert GESTORI["deduplicazione_libro"].esegui is deduplicazione.esegui
    assert (
        GESTORI["standardizzazione_descrizione"].esegui is standardizzazione_descrizione.esegui
    )
