"""Recupero e conversione delle copertine (app/lavori/copertine.py).

Nessuna rete e nessun database: le richieste HTTP passano da
`httpx.MockTransport` (che sta nella libreria, quindi non aggiunge
dipendenze), storage e repository sono monkeypatchati.

Il campione in tests/campioni/google_segnaposto.png è il PNG reale che
Google serve quando un volume non ha copertina: risponde 200, non 404, ed
è il motivo per cui il riconoscitore esiste.
"""

import asyncio
import io
from pathlib import Path
from typing import Any

import httpx
import pytest
from PIL import Image, ImageDraw

from app.lavori import copertine
from app.lavori.errori import ErroreTransitorio

_LIBRO_ID = "00000000-0000-0000-0000-0000000000e1"
_CAMPIONI = Path(__file__).parent / "campioni"


def _copertina_finta(dimensioni: tuple[int, int] = (800, 1200)) -> Image.Image:
    """Una copertina plausibile: fondo colorato con del contrasto sopra."""
    immagine = Image.new("RGB", dimensioni, (36, 74, 122))
    disegno = ImageDraw.Draw(immagine)
    disegno.rectangle([40, 80, dimensioni[0] - 40, 300], fill=(224, 216, 196))
    disegno.rectangle([40, 700, dimensioni[0] - 40, 760], fill=(198, 86, 48))
    return immagine


def _byte(immagine: Image.Image, formato: str = "JPEG") -> bytes:
    buffer = io.BytesIO()
    immagine.save(buffer, format=formato)
    return buffer.getvalue()


# --- riconoscimento del segnaposto ------------------------------------------


def test_riconosce_il_segnaposto_reale_di_google() -> None:
    segnaposto = Image.open(_CAMPIONI / "google_segnaposto.png")
    assert segnaposto.size == (575, 750)
    assert copertine.riconosci_segnaposto(segnaposto) is True


def test_non_scambia_una_copertina_vera_per_un_segnaposto() -> None:
    assert copertine.riconosci_segnaposto(_copertina_finta()) is False


def test_non_scambia_una_copertina_in_bianco_e_nero_per_un_segnaposto() -> None:
    """Il falso positivo che conta: una copertina legittimamente in bianco
    e nero non ha colore, esattamente come il segnaposto. A distinguerle è
    il dettaglio, non la croma — per questo servono entrambi i segnali."""
    immagine = Image.new("L", (400, 600), 255)
    disegno = ImageDraw.Draw(immagine)
    for y in range(0, 600, 40):
        disegno.rectangle([40, y, 360, y + 20], fill=0)
    assert copertine.riconosci_segnaposto(immagine) is False


def test_non_scambia_una_copertina_monocroma_colorata_per_un_segnaposto() -> None:
    """L'altro falso positivo: nessun dettaglio, ma colore eccome."""
    assert copertine.riconosci_segnaposto(Image.new("RGB", (400, 600), (200, 30, 30))) is False


# --- proporzioni ------------------------------------------------------------


def test_riconosce_le_proporzioni_di_una_copertina() -> None:
    assert copertine.ha_proporzioni_da_copertina(_copertina_finta((800, 1200))) is True
    assert copertine.ha_proporzioni_da_copertina(_copertina_finta((338, 500))) is True


def test_scarta_il_frammento_di_scansione_di_google() -> None:
    """Caso reale: per i volumi digitalizzati da biblioteca Google
    restituisce 200 con una striscia (misurato: 575x92 per "Le città
    invisibili"), non la copertina. È grigia ma piena di dettaglio, quindi
    il riconoscitore del segnaposto da solo la lasciava passare e finiva
    sullo scaffale come copertina."""
    striscia = Image.new("L", (575, 92), 150)
    disegno = ImageDraw.Draw(striscia)
    for x in range(0, 575, 20):
        disegno.rectangle([x, 20, x + 10, 70], fill=40)
    assert copertine.riconosci_segnaposto(striscia) is False
    assert copertine.ha_proporzioni_da_copertina(striscia) is False


def test_scarta_una_doppia_pagina() -> None:
    assert copertine.ha_proporzioni_da_copertina(_copertina_finta((1600, 1200))) is False


# --- conversione ------------------------------------------------------------


def test_converti_produce_webp_del_lato_lungo_richiesto() -> None:
    dati = copertine.converti(_copertina_finta((800, 1200)), copertine.LATO_MINIATURA)
    riaperta = Image.open(io.BytesIO(dati))
    assert riaperta.format == "WEBP"
    assert max(riaperta.size) == copertine.LATO_MINIATURA
    # Proporzioni conservate: 800x1200 -> 267x400, non deformata.
    assert riaperta.size == (267, 400)


def test_converti_non_ingrandisce_una_copertina_gia_piccola() -> None:
    """Interpolare non aggiunge dettaglio e i byte in più li paga comunque."""
    dati = copertine.converti(_copertina_finta((200, 300)), copertine.LATO_GRANDE)
    assert Image.open(io.BytesIO(dati)).size == (200, 300)


# --- colore dominante -------------------------------------------------------


def test_colore_dominante_e_un_esadecimale_valido() -> None:
    colore = copertine.colore_dominante(_copertina_finta())
    assert colore.startswith("#")
    assert len(colore) == 7
    int(colore[1:], 16)


def test_colore_dominante_resta_nella_fascia_leggibile() -> None:
    """Il colore finisce sotto il titolo del segnaposto tipografico: fuori
    dalla fascia di luminanza quel titolo non si legge."""
    for immagine in (
        Image.new("RGB", (100, 150), (255, 255, 255)),
        Image.new("RGB", (100, 150), (0, 0, 0)),
        _copertina_finta(),
    ):
        colore = copertine.colore_dominante(immagine)
        rgb = (int(colore[1:3], 16), int(colore[3:5], 16), int(colore[5:7], 16))
        assert copertine._luminanza(rgb) <= copertine._LUMINANZA_MAX + 0.01


def test_colore_dominante_scuro_e_desaturato_rispetto_al_chiaro() -> None:
    """docs/design-frontend.md §3: "seconda versione calcolata, più
    desaturata" per la stanza scura, stessa tonalità del colore chiaro."""
    immagine = _copertina_finta()
    chiaro = copertine.colore_dominante(immagine)
    scuro = copertine.colore_dominante_scuro(immagine)
    assert scuro.startswith("#") and len(scuro) == 7
    int(scuro[1:], 16)

    def croma(colore: str) -> int:
        r, g, b = (int(colore[i : i + 2], 16) for i in (1, 3, 5))
        return max(r, g, b) - min(r, g, b)

    assert croma(scuro) < croma(chiaro)


# --- il lavoro completo -----------------------------------------------------


class _Scritture:
    def __init__(self) -> None:
        self.caricati: dict[str, bytes] = {}
        self.stato: str | None = None
        self.copertina: tuple[str, str, str] | None = None


@pytest.fixture
def scritture(monkeypatch: pytest.MonkeyPatch) -> _Scritture:
    registro = _Scritture()

    monkeypatch.setattr(
        copertine.storage,
        "carica",
        lambda percorso, contenuto, content_type="image/webp": registro.caricati.__setitem__(
            percorso, contenuto
        ),
    )

    async def _scrivi_stato(libro_id: str, stato: str) -> None:
        registro.stato = stato

    monkeypatch.setattr(copertine, "_scrivi_stato", _scrivi_stato)

    def _apri_connessione() -> Any:
        raise AssertionError("il percorso con immagine deve passare da aggiorna_copertina")

    monkeypatch.setattr(copertine.database, "apri_connessione", _apri_connessione)
    return registro


def _con_risposte(monkeypatch: pytest.MonkeyPatch, risposte: dict[str, httpx.Response]) -> None:
    """Sostituisce il trasporto di httpx, non la funzione: così si esercita
    davvero la costruzione degli URL e la lettura dei codici di stato."""

    def _gestisci(richiesta: httpx.Request) -> httpx.Response:
        for frammento, risposta in risposte.items():
            if frammento in str(richiesta.url):
                return risposta
        return httpx.Response(404)

    originale = httpx.AsyncClient

    def _client(*args: Any, **kwargs: Any) -> httpx.AsyncClient:
        kwargs["transport"] = httpx.MockTransport(_gestisci)
        return originale(*args, **kwargs)

    monkeypatch.setattr(copertine.httpx, "AsyncClient", _client)


def test_copertina_assente_alla_fonte_e_un_esito_non_un_fallimento(
    scritture: _Scritture, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Google risponde 200 con il segnaposto grigio e Open Library non ha
    l'ISBN: la scheda diventa 'assente' e il lavoro RIESCE. È così che la
    regola del PRD ("senza ulteriori tentativi automatici") si realizza
    senza casi particolari — nessuno chiede un altro tentativo."""
    segnaposto = (_CAMPIONI / "google_segnaposto.png").read_bytes()
    _con_risposte(
        monkeypatch,
        {
            "books.google.com": httpx.Response(200, content=segnaposto),
            "covers.openlibrary.org": httpx.Response(404),
        },
    )

    asyncio.run(
        copertine.esegui(
            {"libro_id": _LIBRO_ID, "google_volume_id": "abc123", "isbn13": "9780000000001"}
        )
    )

    assert scritture.stato == "assente"
    assert scritture.caricati == {}


def test_ripiego_su_open_library_quando_google_non_ha_la_copertina(
    scritture: _Scritture, monkeypatch: pytest.MonkeyPatch
) -> None:
    segnaposto = (_CAMPIONI / "google_segnaposto.png").read_bytes()
    aggiornamenti: list[tuple[str, str, str]] = []

    monkeypatch.setattr(
        copertine.catalogo_repository,
        "aggiorna_copertina",
        lambda conn, libro_id, mini, grande, colore, colore_scuro: aggiornamenti.append(
            (mini, grande, colore)
        ),
    )
    monkeypatch.setattr(copertine.database, "apri_connessione", lambda: _ConnessioneContesto())
    _con_risposte(
        monkeypatch,
        {
            "books.google.com": httpx.Response(200, content=segnaposto),
            "covers.openlibrary.org": httpx.Response(200, content=_byte(_copertina_finta())),
        },
    )

    asyncio.run(
        copertine.esegui(
            {"libro_id": _LIBRO_ID, "google_volume_id": "abc123", "isbn13": "9780000000001"}
        )
    )

    assert scritture.stato is None
    assert set(scritture.caricati) == {
        f"{_LIBRO_ID}/miniatura.webp",
        f"{_LIBRO_ID}/grande.webp",
    }
    assert len(aggiornamenti) == 1


def test_una_striscia_di_scansione_non_diventa_una_copertina(
    scritture: _Scritture, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Il caso che la verifica sul campo ha scoperto, per intero: Google
    risponde 200 con un frammento, Open Library non ha l'ISBN, e la scheda
    deve restare senza copertina invece di prendersi la striscia."""
    striscia = Image.new("L", (575, 92), 150)
    disegno = ImageDraw.Draw(striscia)
    for x in range(0, 575, 20):
        disegno.rectangle([x, 20, x + 10, 70], fill=40)
    _con_risposte(
        monkeypatch,
        {
            "books.google.com": httpx.Response(200, content=_byte(striscia, "PNG")),
            "covers.openlibrary.org": httpx.Response(404),
        },
    )

    asyncio.run(
        copertine.esegui(
            {"libro_id": _LIBRO_ID, "google_volume_id": "Fs1oAAAAMAAJ", "isbn13": "9780000000001"}
        )
    )

    assert scritture.stato == "assente"
    assert scritture.caricati == {}


def test_errore_di_trasporto_e_transitorio(
    scritture: _Scritture, monkeypatch: pytest.MonkeyPatch
) -> None:
    """503 dalla fonte: si riprova, non si segna la scheda come fallita —
    quello lo decide il worker quando i tentativi si esauriscono."""
    _con_risposte(monkeypatch, {"books.google.com": httpx.Response(503)})

    with pytest.raises(ErroreTransitorio):
        asyncio.run(copertine.esegui({"libro_id": _LIBRO_ID, "google_volume_id": "abc123"}))

    assert scritture.stato is None


def test_su_fallimento_rende_osservabile_il_fallimento_sulla_scheda(
    scritture: _Scritture,
) -> None:
    asyncio.run(copertine.su_fallimento({"libro_id": _LIBRO_ID}, "tre timeout"))
    assert scritture.stato == "fallita"


class _ConnessioneContesto:
    def __enter__(self) -> "_ConnessioneContesto":
        return self

    def __exit__(self, *args: object) -> None:
        return None
