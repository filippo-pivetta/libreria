"""Client dei cataloghi: normalizzazione, collasso per opera, pulizia dei
titoli e traduzione degli errori. Nessuna rete: le risposte HTTP passano
da `httpx.MockTransport`.

Molti di questi casi vengono da stringhe REALI incontrate provando le API
dal vivo, non da dati inventati: sono annotati dove lo sono, perché è
l'unico modo per capire, rileggendoli, perché una regola esiste.
"""

from typing import Any

import httpx
import pytest

from app.cataloghi import google_books as gb
from app.cataloghi import open_library as ol
from app.cataloghi.errori import FonteNonRaggiungibileError


def _elemento(
    volume_id: str,
    titolo: str,
    autori: list[str] | None = None,
    isbn13: str | None = None,
    con_copertina: bool = False,
    **extra: Any,
) -> dict[str, Any]:
    info: dict[str, Any] = {"title": titolo, **extra}
    if autori:
        info["authors"] = autori
    if isbn13:
        info["industryIdentifiers"] = [{"type": "ISBN_13", "identifier": isbn13}]
    if con_copertina:
        info["imageLinks"] = {"thumbnail": "http://books.google.com/x"}
    return {"id": volume_id, "volumeInfo": info}


# --- pulizia dei titoli -----------------------------------------------------


@pytest.mark.parametrize(
    ("grezzo", "atteso"),
    [
        # Tutte stringhe reali viste nei risultati di Google Books.
        ("Sapiens. Da animali a dèi (Nuova edizione decennale)", "Sapiens. Da animali a dèi"),
        ("La Solitudine Dei Numeri Primi (Italian Edition)", "La Solitudine Dei Numeri Primi"),
        ("1984 [Classici moderni]", "1984"),
        ("Le città invisibili - Nuova edizione", "Le città invisibili"),
        # Reale, causa diretta di un duplicato osservato in libreria:
        # "Le notti bianche" e "Le notti bianche. Testo russo a fronte"
        # sono la stessa opera di Dostoevskij.
        ("Le notti bianche. Testo russo a fronte", "Le notti bianche"),
        ("Le fiabe. Testo francese a fronte", "Le fiabe"),
        # Un sottotitolo legittimo NON è rumore d'edizione e resta.
        ("Il nome della rosa", "Il nome della rosa"),
    ],
)
def test_pulisci_titolo(grezzo: str, atteso: str) -> None:
    assert gb.pulisci_titolo(grezzo) == atteso


@pytest.mark.parametrize(
    ("titolo", "autori", "atteso"),
    [
        # Reale: i record digitalizzati da biblioteca incollano l'autore.
        (
            "Il gattopardo [di] Giuseppe Tomasi de Lampedusa",
            ["Giuseppe Tomasi de Lampedusa"],
            "Il gattopardo",
        ),
        ("Il nome della rosa di Umberto Eco", ["Umberto Eco"], "Il nome della rosa"),
        # Un titolo che è il nome dell'autore (una biografia) non va svuotato.
        ("Umberto Eco", ["Umberto Eco"], "Umberto Eco"),
        # Una preposizione interna al titolo non è un residuo da togliere.
        ("La coscienza di Zeno", ["Italo Svevo"], "La coscienza di Zeno"),
    ],
)
def test_autore_incollato_al_titolo(titolo: str, autori: list[str], atteso: str) -> None:
    assert gb._volume(_elemento("x", titolo, autori)).titolo == atteso


# --- collasso per opera -----------------------------------------------------


def test_collassa_le_edizioni_della_stessa_opera() -> None:
    """Il PRD vieta la scelta dell'edizione: mostrare otto volumi di "1984"
    sarebbe chiederla, mascherata da elenco di risultati."""
    volumi = [
        gb._volume(_elemento("a", "1984", ["George Orwell"])),
        gb._volume(_elemento("b", "1984", ["George Orwell"], isbn13="9780000000001")),
        gb._volume(_elemento("c", "1984: Nuova edizione annotata", ["Orwell, George"])),
        gb._volume(_elemento("d", "La fattoria degli animali", ["George Orwell"])),
    ]
    opere = gb.collassa_per_opera([v for v in volumi if v])

    assert len(opere) == 2
    prima = opere[0]
    assert len(prima.alternativi) == 2
    # Rappresentante scelto per l'ISBN, non per l'ordine di arrivo: è
    # l'unico dato che apre la strada all'identità dell'opera.
    assert prima.rappresentante.volume_id == "b"


def test_il_collasso_raccoglie_tutti_gli_isbn_del_gruppo() -> None:
    """È il guadagno del collasso: più ISBN da provare significa più
    probabilità che la risoluzione per ISBN vada a segno."""
    volumi = [
        gb._volume(_elemento("a", "1984", ["George Orwell"], isbn13="9780000000001")),
        gb._volume(_elemento("b", "1984", ["George Orwell"], isbn13="9780000000002")),
        gb._volume(_elemento("c", "1984", ["George Orwell"])),
    ]
    opere = gb.collassa_per_opera([v for v in volumi if v])
    assert opere[0].isbn_disponibili == ["9780000000001", "9780000000002"]


def test_il_sottotitolo_non_separa_due_edizioni_della_stessa_opera() -> None:
    """Il sottotitolo è il posto in cui gli editori mettono ciò che
    distingue l'edizione, non l'opera."""
    volumi = [
        gb._volume(_elemento("a", "Il nome della rosa", ["Umberto Eco"])),
        gb._volume(_elemento("b", "Il nome della rosa: con le postille", ["Umberto Eco"])),
    ]
    assert len(gb.collassa_per_opera([v for v in volumi if v])) == 1


# --- copertine nei risultati ------------------------------------------------


def test_copertina_assente_e_none_non_un_indirizzo_da_provare() -> None:
    """Un volume senza copertina risponde comunque 200, con un segnaposto
    grigio: `onError` non scatterebbe e la riga mostrerebbe un rettangolo
    grigio invece del segnaposto tipografico."""
    volume = gb._volume(_elemento("x", "Senza copertina"))
    assert volume is not None
    assert volume.copertina_url is None


def test_la_copertina_e_servita_in_https() -> None:
    """Google restituisce http: una pagina in https non caricherebbe
    l'immagine, e il browser non lo direbbe in modo comprensibile."""
    volume = gb._volume(_elemento("x", "Con copertina", con_copertina=True))
    assert volume is not None
    assert volume.copertina_url is not None
    assert volume.copertina_url.startswith("https://")


def test_l_anno_del_volume_non_e_l_anno_dell_opera() -> None:
    """PRD: per un classico ristampato l'anno dell'edizione sarebbe
    plausibile e sbagliato. Il campo esiste ma si chiama come ciò che è."""
    volume = gb._volume(_elemento("x", "Ristampa", publishedDate="2019-03-01"))
    assert volume is not None
    assert volume.anno_pubblicazione == 2019


# --- errori -----------------------------------------------------------------


def _con_risposta(monkeypatch: pytest.MonkeyPatch, risposta: httpx.Response) -> None:
    originale = httpx.AsyncClient

    def _client(*args: Any, **kwargs: Any) -> httpx.AsyncClient:
        kwargs["transport"] = httpx.MockTransport(lambda _: risposta)
        return originale(*args, **kwargs)

    monkeypatch.setattr(gb.httpx, "AsyncClient", _client)
    monkeypatch.setattr(ol.httpx, "AsyncClient", _client)


def test_quota_esaurita_e_fonte_non_raggiungibile(monkeypatch: pytest.MonkeyPatch) -> None:
    """Per chi cerca, quota esaurita e catalogo giù sono la stessa cosa;
    e nessuna delle due è un errore del nostro sistema."""
    gb.svuota_cache()
    monkeypatch.setattr(gb.get_settings(), "google_books_api_key", "prova", raising=False)
    _con_risposta(monkeypatch, httpx.Response(429))

    with pytest.raises(FonteNonRaggiungibileError) as errore:
        __import__("asyncio").run(gb.cerca("qualcosa"))
    assert errore.value.fonte == "google_books"
    assert "quota" in errore.value.motivo


def test_senza_chiave_e_uno_stato_dichiarabile_non_un_guasto(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    gb.svuota_cache()
    monkeypatch.setattr(gb.get_settings(), "google_books_api_key", None, raising=False)
    with pytest.raises(FonteNonRaggiungibileError):
        __import__("asyncio").run(gb.cerca("qualcosa"))


def test_messaggio_di_errore_mai_vuoto() -> None:
    """`ConnectTimeout` e altre eccezioni di httpx hanno il messaggio
    vuoto, e un log che dice solo "open_library: " non aiuta nessuno."""
    errore = FonteNonRaggiungibileError.da_httpx("open_library", httpx.ConnectTimeout(""))
    assert "ConnectTimeout" in errore.motivo


# --- Open Library -----------------------------------------------------------


def test_la_guardia_sulle_edizioni_separa_le_opere_dagli_stub() -> None:
    """Misurato: "Il nome della rosa" sta a 151 edizioni, e i record orfani
    che gli si affiancano nei risultati per testo stanno a 1. Senza questa
    guardia il ripiego per testo creerebbe schede sbagliate — ed essendo
    convinto di aver canonicalizzato, non le ricostruirebbe mai."""
    vera = ol.OperaOL("OL1W", "Il nome della rosa", ("Umberto Eco",), 1980, 533, 151, ())
    stub = ol.OperaOL("OL2W", "Le Nom de la Rose", (), None, None, 1, ())
    assert vera.e_plausibile is True
    assert stub.e_plausibile is False


def test_work_id_senza_prefisso() -> None:
    """È la forma che finisce in libro_riferimento_esterno.identificativo:
    se ci finisse "/works/OL1W" non corrisponderebbe mai."""
    opera = ol._opera({"key": "/works/OL8996439W", "title": "x", "edition_count": 5})
    assert opera is not None
    assert opera.work_id == "OL8996439W"


# --- normalizzazione dei nomi (app/core/testo.py) ---------------------------


@pytest.mark.parametrize(
    ("nome", "atteso"),
    [
        # Le due forme che i cataloghi alternano per la STESSA persona.
        ("Umberto Eco", "eco"),
        ("Eco, Umberto", "eco"),
        ("George Orwell", "orwell"),
        ("Orwell, George", "orwell"),
        # Le particelle fanno parte del cognome e non lo terminano.
        ("Giuseppe Tomasi di Lampedusa", "lampedusa"),
        ("Tomasi di Lampedusa, Giuseppe", "lampedusa"),
        ("Gabriel García Márquez", "marquez"),
        ("", ""),
    ],
)
def test_cognome(nome: str, atteso: str) -> None:
    from app.core.testo import cognome

    assert cognome(nome) == atteso


def test_le_due_forme_dello_stesso_autore_finiscono_nello_stesso_gruppo() -> None:
    """Il difetto che ha reso necessario un modulo condiviso: prendere
    l'ultima parola senza guardare la virgola dava "george" per "Orwell,
    George", e le due edizioni finivano in gruppi diversi."""
    volumi = [
        gb._volume(_elemento("a", "1984", ["George Orwell"])),
        gb._volume(_elemento("b", "1984", ["Orwell, George"])),
    ]
    assert len(gb.collassa_per_opera([v for v in volumi if v])) == 1
