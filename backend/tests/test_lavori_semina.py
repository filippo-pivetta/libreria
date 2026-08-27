"""La scelta del risultato da seminare (app/lavori/semina.py::_scegli).

È il punto in cui la semina può sbagliare in silenzio: cercando un
classico per titolo, Google restituisce guide di lettura, riassunti e
antologie che lo citano, e prendere il primo risultato seminerebbe
quelli. Una scheda nata male si corregge solo a mano (`fondi_libro`),
quindi qui si preferisce sempre non seminare al seminare la cosa
sbagliata.
"""

from app.cataloghi.google_books import Opera, Volume
from app.lavori.semina import _scegli


def _volume(titolo: str, autori: tuple[str, ...], volume_id: str = "v1") -> Volume:
    return Volume(
        volume_id=volume_id,
        titolo=titolo,
        sottotitolo=None,
        autori=autori,
        lingua="it",
        anno_pubblicazione=2000,
        pagine=300,
        isbn13=None,
        categorie=(),
        descrizione=None,
        copertina_url=None,
    )


def _opera(titolo: str, autori: tuple[str, ...], volume_id: str = "v1") -> Opera:
    return Opera(rappresentante=_volume(titolo, autori, volume_id))


def test_prende_la_corrispondenza_piena() -> None:
    opere = [_opera("Il nome della rosa", ("Umberto Eco",))]
    assert _scegli(opere, "Il nome della rosa", ["Umberto Eco"]) is opere[0]


def test_ignora_il_risultato_di_un_altro_autore() -> None:
    """Il caso che il vincolo sull'autore esiste per fermare: una guida di
    lettura ha il titolo dell'opera e un autore diverso."""
    opere = [
        _opera("Il nome della rosa: guida alla lettura", ("Mario Rossi",), "v1"),
        _opera("Il nome della rosa", ("Umberto Eco",), "v2"),
    ]
    scelta = _scegli(opere, "Il nome della rosa", ["Umberto Eco"])
    assert scelta is opere[1]


def test_riconosce_l_autore_scritto_al_contrario() -> None:
    """I cataloghi alternano "Umberto Eco" ed "Eco, Umberto": il confronto
    è sui cognomi, non sulla stringa intera."""
    opere = [_opera("Il nome della rosa", ("Eco, Umberto",))]
    assert _scegli(opere, "Il nome della rosa", ["Umberto Eco"]) is opere[0]


def test_tollera_il_sottotitolo_in_piu() -> None:
    opere = [_opera("Il nome della rosa. Romanzo", ("Umberto Eco",))]
    assert _scegli(opere, "Il nome della rosa", ["Umberto Eco"]) is opere[0]


def test_rifiuta_un_titolo_troppo_diverso() -> None:
    """Stesso autore, altra opera: senza la soglia sul titolo, cercare un
    libro poco noto di un autore prolifico seminerebbe il suo bestseller."""
    opere = [_opera("Il pendolo di Foucault", ("Umberto Eco",))]
    assert _scegli(opere, "La misteriosa fiamma della regina Loana", ["Umberto Eco"]) is None


def test_rifiuta_quando_google_non_dichiara_autori() -> None:
    opere = [_opera("Il nome della rosa", ())]
    assert _scegli(opere, "Il nome della rosa", ["Umberto Eco"]) is None


def test_nessun_risultato_non_e_un_errore() -> None:
    assert _scegli([], "Il nome della rosa", ["Umberto Eco"]) is None


def test_rifiuta_l_antologia_che_contiene_il_titolo() -> None:
    """Il caso trovato dal vivo: cercando "Nineteen Eighty-Four" di Orwell,
    Google restituisce un'antologia tedesca il cui titolo contiene tutte le
    parole attese. Seminarla darebbe l'anno dell'antologia (1980) al posto
    di quello dell'opera (1949), e l'errore passerebbe inosservato."""
    antologia = _opera("George Orwell: 1984 / Nineteen Eighty-Four", ("George Orwell",), "v1")
    assert _scegli([antologia], "Nineteen Eighty-Four", ["George Orwell"]) is None


def test_preferisce_l_opera_all_antologia_quando_ci_sono_entrambe() -> None:
    opere = [
        _opera("George Orwell: 1984 / Nineteen Eighty-Four", ("George Orwell",), "v1"),
        _opera("Nineteen Eighty-Four", ("George Orwell",), "v2"),
    ]
    assert _scegli(opere, "Nineteen Eighty-Four", ["George Orwell"]) is opere[1]
