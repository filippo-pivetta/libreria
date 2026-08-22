"""Il dizionario dei gestori (app/lavori/registro.py): verifica che ogni
tipo di lavoro sia registrato e punti alla funzione giusta — lo stesso
elenco che `chk_lavoro_tipo` rende l'unico ammesso lato database
(migrazione 20260822173331, l'ultima ad averlo esteso). Il vincolo SQL e
questo dizionario sono scritti due volte apposta: un tipo accodato ma non
registrato fallirebbe a runtime, uno registrato ma non ammesso dal CHECK
non potrebbe nemmeno essere accodato."""

from app.lavori import (
    arricchimento_bibliografico,
    copertine,
    deduplicazione,
    descrizioni,
    indicizzazione_semantica,
    ricostruzione_indici,
    standardizzazione_descrizione,
    traduzione_descrizione,
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
        "indicizzazione_semantica",
        "ricostruzione_indici",
        "traduzione_descrizione",
    }


def test_ogni_gestore_punta_al_modulo_giusto() -> None:
    assert GESTORI["copertina"].esegui is copertine.esegui
    assert GESTORI["descrizione"].esegui is descrizioni.esegui
    assert GESTORI["arricchimento_bibliografico"].esegui is arricchimento_bibliografico.esegui
    assert GESTORI["riconduzione_autore"].esegui is riconduzione_autori_modulo.esegui
    assert GESTORI["deduplicazione_libro"].esegui is deduplicazione.esegui
    assert GESTORI["standardizzazione_descrizione"].esegui is standardizzazione_descrizione.esegui
    assert GESTORI["indicizzazione_semantica"].esegui is indicizzazione_semantica.esegui
    assert GESTORI["ricostruzione_indici"].esegui is ricostruzione_indici.esegui
    assert GESTORI["traduzione_descrizione"].esegui is traduzione_descrizione.esegui
