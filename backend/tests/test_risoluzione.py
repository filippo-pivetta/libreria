"""La catena che porta da un volume di Google all'identità dell'opera.

Nessuna rete: le tre fonti (Open Library, Wikidata) sono sostituite dalle
loro funzioni, perché ciò che va verificato qui è l'ARBITRAGGIO fra fonti
— chi vince su quale campo — non il loro trasporto, già coperto da
`test_cataloghi.py`.
"""

import asyncio
from typing import Any

import pytest

from app.cataloghi import google_books as gb
from app.cataloghi import open_library as ol
from app.services import risoluzione


def _volume(titolo: str = "Il nome della rosa", **extra: Any) -> gb.Volume:
    campi: dict[str, Any] = {
        "volume_id": "v1",
        "titolo": titolo,
        "sottotitolo": None,
        "autori": ("Umberto Eco",),
        "lingua": "it",
        "anno_pubblicazione": 2019,
        "pagine": 512,
        "isbn13": "9788845292613",
        "categorie": (),
        "descrizione": None,
        "copertina_url": None,
    }
    campi.update(extra)
    return gb.Volume(**campi)


def _senza_wikidata(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _niente(*args: Any, **kwargs: Any) -> None:
        return None

    monkeypatch.setattr(risoluzione.wikidata, "per_open_library", _niente)
    monkeypatch.setattr(risoluzione.wikidata, "cerca_opera", _niente)


def _con_isbn(monkeypatch: pytest.MonkeyPatch, opera: ol.OperaOL | None) -> None:
    async def _per_isbn(isbn: str) -> ol.OperaOL | None:
        return opera

    async def _per_testo(termine: str, limite: int = 5) -> list[ol.OperaOL]:
        return []

    monkeypatch.setattr(risoluzione.open_library, "per_isbn", _per_isbn)
    monkeypatch.setattr(risoluzione.open_library, "per_testo", _per_testo)


def test_un_record_ricco_detta_titolo_canonico_e_anno(monkeypatch: pytest.MonkeyPatch) -> None:
    """Il comportamento di sempre, che non deve cambiare: quando Open
    Library conosce davvero l'opera è lei la fonte migliore, e il suo
    titolo è l'identità della scheda."""
    _senza_wikidata(monkeypatch)
    _con_isbn(
        monkeypatch,
        ol.OperaOL("OL1W", "Il nome della rosa", ("Umberto Eco",), 1980, 533, 151, ()),
    )

    scheda = asyncio.run(risoluzione.risolvi(gb.Opera(rappresentante=_volume())))

    assert scheda.titolo_canonico == "Il nome della rosa"
    assert scheda.anno_prima_pubblicazione == 1980
    assert scheda.pagine_mediane == 533
    assert ("open_library", "OL1W", True) in scheda.riferimenti


def test_un_record_orfano_non_detta_ne_titolo_ne_anno(monkeypatch: pytest.MonkeyPatch) -> None:
    """La guardia `e_plausibile` esisteva ma copriva solo il ripiego per
    testo. Il passo ISBN prendeva il primo risultato a scatola chiusa, e
    `risolvi` ne copiava titolo e anno senza condizioni.

    Su un record orfano (misurato: `isbn:` restituisce regolarmente opere
    con `edition_count: 1`) questo scriveva due dati sbagliati nel catalogo
    CONDIVISO: un titolo canonico grezzo al posto di quello già ripulito, e
    soprattutto l'anno di QUELLA edizione come anno di prima pubblicazione
    — per una ristampa moderna di un classico è l'errore "plausibile e
    sbagliato" che il PRD nomina per esteso, quindi invisibile."""
    _senza_wikidata(monkeypatch)
    _con_isbn(
        monkeypatch,
        ol.OperaOL("OL999W", "NOME DELLA ROSA, IL - ed. speciale", (), 2019, 480, 1, ()),
    )

    scheda = asyncio.run(risoluzione.risolvi(gb.Opera(rappresentante=_volume())))

    assert scheda.titolo_canonico == "Il nome della rosa"
    assert scheda.anno_prima_pubblicazione is None
    # L'identità resta comunque registrata: quel work_id è, per Open
    # Library, l'opera a cui quell'ISBN appartiene, e serve a riconoscere
    # la scheda la prossima volta. È il contenuto a essere filtrato.
    assert ("open_library", "OL999W", True) in scheda.riferimenti
    assert scheda.canonicalizzata


def test_un_record_orfano_col_titolo_giusto_resta_accettato(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Un record povero che dice la stessa cosa che sappiamo già non può
    sbagliarla: la guardia non deve buttare via l'anno in questo caso, o
    perderemmo il dato proprio dove è più probabile che manchi (opere poco
    diffuse, che su Open Library hanno per forza poche edizioni)."""
    _senza_wikidata(monkeypatch)
    _con_isbn(
        monkeypatch,
        ol.OperaOL("OL2W", "Il nome della rosa", ("Umberto Eco",), 1980, 533, 1, ()),
    )

    scheda = asyncio.run(risoluzione.risolvi(gb.Opera(rappresentante=_volume())))

    assert scheda.anno_prima_pubblicazione == 1980


def test_l_anno_dell_edizione_non_diventa_mai_l_anno_dell_opera(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Nessuna fonte ha saputo dire l'anno: deve restare assente, mai
    ripiegare sull'anno dell'edizione che Google conosce (2019)."""
    _senza_wikidata(monkeypatch)
    _con_isbn(monkeypatch, None)

    scheda = asyncio.run(risoluzione.risolvi(gb.Opera(rappresentante=_volume())))

    assert scheda.anno_prima_pubblicazione is None
    assert not scheda.canonicalizzata


def test_wikidata_giu_non_nega_l_aggiunta(monkeypatch: pytest.MonkeyPatch) -> None:
    """L'arricchimento non è mai nel percorso critico: Wikidata risponde
    429 a raffiche ravvicinate, e un'aggiunta non deve fallire per questo."""
    from app.cataloghi.errori import FonteNonRaggiungibileError

    async def _esplode(*args: Any, **kwargs: Any) -> None:
        raise FonteNonRaggiungibileError("wikidata", "HTTP 429")

    monkeypatch.setattr(risoluzione.wikidata, "per_open_library", _esplode)
    monkeypatch.setattr(risoluzione.wikidata, "cerca_opera", _esplode)
    _con_isbn(
        monkeypatch,
        ol.OperaOL("OL1W", "Il nome della rosa", ("Umberto Eco",), 1980, 533, 151, ()),
    )

    scheda = asyncio.run(risoluzione.risolvi(gb.Opera(rappresentante=_volume())))

    assert scheda.titolo_canonico == "Il nome della rosa"
