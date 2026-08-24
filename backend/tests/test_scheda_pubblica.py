"""La scheda di un libro guardato prima di aggiungerlo, e il parere che
ci si può chiedere sopra (docs/design-frontend.md §13).

Quattro cose che questa suite tiene ferme, ciascuna con un perché che
sopravvive al codice che la implementa:

- **guardare non fa nascere una scheda**: nessun ramo di questo modulo
  deve arrivare a `crea_scheda` né accodare un lavoro, altrimenti la
  catena di risoluzione (oltre dieci secondi, ADR 0002) finirebbe dietro
  la digitazione invece che dietro l'aggiunta;
- **l'anno di Google è quello dell'edizione**: esce marcato come tale e
  non raggiunge mai il modello come anno di prima pubblicazione (PRD);
- **il parere non si salva**: senza Voce non c'è artefatto, e nessuna
  riga deve comparire in `artefatto_generato`;
- **un volume già noto al catalogo si serve dalla scheda vera**, non dai
  dati di Google.
"""

import asyncio
from collections.abc import Iterator
from typing import Any
from uuid import UUID

import httpx
import pytest
from fastapi.testclient import TestClient

from app.cataloghi import google_books
from app.cataloghi.errori import FonteNonRaggiungibileError
from app.core.security import get_current_user
from app.main import app
from app.repositories import artefatto_repository, preview_repository, scheda_repository
from app.schemas.auth import AuthenticatedUser
from app.services import consenso as consenso_service
from app.services import preview_service, ricerca_service, scheda_pubblica_service
from tests.openai_finto import con_chiave, con_risposta, risposta_chat

_USER_ID = UUID("00000000-0000-0000-0000-0000000000a1")
_LIBRO_ID = UUID("00000000-0000-0000-0000-0000000000b1")
_VOCE_ID = UUID("00000000-0000-0000-0000-0000000000c1")
_VOLUME_ID = "gbv-123"

_SCHEDA_LOCALE: dict[str, Any] = {
    "libro_id": str(_LIBRO_ID),
    "titolo": "Le città invisibili",
    "titolo_canonico": "Le città invisibili",
    "autori": ["Italo Calvino"],
    "anno_prima_pubblicazione": 1972,
    "anno_dedotto": False,
    "lingua_originale": "it",
    "pagine": 164,
    "generi": [{"id": "narrativa_contemporanea", "etichetta": "Narrativa contemporanea"}],
    "descrizione": "Un dialogo fra Marco Polo e Kublai Khan.",
    "descrizione_fonte": "wikipedia",
    "copertina_path": None,
    "copertina_colore_dominante": None,
    "copertina_colore_dominante_scuro": None,
    "copertina_stato": "assente",
}

_VOLUME = google_books.Volume(
    volume_id=_VOLUME_ID,
    titolo="Il nome della rosa",
    sottotitolo=None,
    autori=("Umberto Eco",),
    lingua="it",
    # Ristampa del 2019 di un romanzo del 1980: è esattamente il caso in
    # cui prendere questo numero per l'anno dell'opera sarebbe plausibile
    # e sbagliato.
    anno_pubblicazione=2019,
    pagine=608,
    isbn13="9788845292613",
    categorie=("Fiction / Mystery & Detective / Historical",),
    descrizione="In un'abbazia del Trecento una serie di morti sospette.",
    copertina_url="https://books.google.com/x",
)

_PROFILO = [
    {
        "voce_id": "voce-barone",
        "stato": "letto",
        "titolo": "Il barone rampante",
        "autori": ["Italo Calvino"],
        "generi": ["Classici"],
        "descrizione": None,
        "voto": 4.5,
        "recensione": None,
        "insight": ["Calvino mi piace quando gioca con la struttura."],
        "data_conclusa": "2024-01-01",
        "data_abbandonata": None,
    }
]


def _run(coro: Any) -> Any:
    return asyncio.run(coro)


@pytest.fixture
def authenticated(client: TestClient) -> Iterator[TestClient]:
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        id=_USER_ID, email="ignorata@example.com", access_token="test-token"
    )
    try:
        yield client
    finally:
        del app.dependency_overrides[get_current_user]


@pytest.fixture
def dati(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    """Catalogo e Google finti, più il registro di ciò che è stato
    salvato: la sua lunghezza è il test della promessa "guardare non
    scrive niente"."""
    registro: dict[str, Any] = {
        "consenso": True,
        "scheda": dict(_SCHEDA_LOCALE),
        "voce": None,
        "volume": _VOLUME,
        "libro_noto": None,
        "salvati": [],
    }

    async def _esigi(access_token: str, utente_id: UUID) -> str:
        if not registro["consenso"]:
            raise consenso_service.ConsensoRevocatoError
        return "pronti"

    async def _volume(volume_id: str) -> google_books.Volume | None:
        return registro["volume"]

    def _create(*args: Any, **kwargs: Any) -> dict[str, Any]:
        registro["salvati"].append(args)
        raise AssertionError("Un parere su un libro non in libreria non si salva.")

    monkeypatch.setattr(consenso_service, "esigi_consenso", _esigi)
    monkeypatch.setattr(scheda_pubblica_service, "get_user_client", lambda token: object())
    monkeypatch.setattr(preview_service, "get_user_client", lambda token: object())
    monkeypatch.setattr(scheda_repository, "scheda", lambda c, i, lingua: registro["scheda"])
    monkeypatch.setattr(
        scheda_repository,
        "etichette_generi",
        lambda c, generi, lingua: [{"id": g, "etichetta": g.capitalize()} for g in generi],
    )
    monkeypatch.setattr(ricerca_service, "voce_per_libro", lambda c, u, i: registro["voce"])
    monkeypatch.setattr(google_books, "per_identificativo", _volume)
    monkeypatch.setattr(
        scheda_pubblica_service, "_libro_per_riferimenti", lambda r: registro["libro_noto"]
    )
    monkeypatch.setattr(preview_repository, "profilo_suggerimenti", lambda c, u: _PROFILO)
    monkeypatch.setattr(artefatto_repository, "create", _create)
    return registro


# --- la carta ---------------------------------------------------------------


def test_scheda_di_catalogo(dati: dict[str, Any], authenticated: TestClient) -> None:
    risposta = authenticated.get(f"/schede/catalogo/{_LIBRO_ID}")

    assert risposta.status_code == 200
    corpo = risposta.json()
    assert corpo["fonte"] == "catalogo"
    assert corpo["titolo"] == "Le città invisibili"
    assert corpo["anno"] == 1972
    assert corpo["anno_di_edizione"] is False
    assert corpo["descrizione_fonte"] == "wikipedia"


def test_la_propria_voce_regge_il_verbo(dati: dict[str, Any], authenticated: TestClient) -> None:
    """Un libro già in libreria non deve offrire "Aggiungi": la carta lo sa
    dalla Voce, come la riga di ricerca (§13)."""
    dati["voce"] = {
        "id": str(_VOCE_ID),
        "stato": "letto",
        "voto": 4.0,
        "pagina_corrente": None,
        "anno_ultima_lettura": None,
    }

    corpo = authenticated.get(f"/schede/catalogo/{_LIBRO_ID}").json()

    assert corpo["voce"]["id"] == str(_VOCE_ID)
    assert corpo["voce"]["stato"] == "letto"


def test_scheda_di_google_dice_che_lanno_e_delledizione(
    dati: dict[str, Any], authenticated: TestClient
) -> None:
    corpo = authenticated.get(f"/schede/google/{_VOLUME_ID}").json()

    assert corpo["fonte"] == "google"
    assert corpo["libro_id"] is None
    assert corpo["anno"] == 2019
    assert corpo["anno_di_edizione"] is True
    # Fuori dal sistema la descrizione è la quarta di copertina, e la carta
    # lo dichiara invece di farla passare per prosa enciclopedica (§21).
    assert corpo["descrizione_fonte"] == "google_books"
    # I generi si deducono dai soggetti con la mappatura deterministica,
    # senza far nascere nulla in database.
    assert corpo["generi"]


def test_un_volume_gia_noto_si_serve_dalla_scheda_vera(
    dati: dict[str, Any], authenticated: TestClient
) -> None:
    """Stessi dati che si vedrebbero dopo l'aggiunta — e il `libro_id`, che
    è ciò con cui il frontend chiama `POST /voci` invece di `POST /libri`."""
    dati["libro_noto"] = _LIBRO_ID

    corpo = authenticated.get(f"/schede/google/{_VOLUME_ID}").json()

    assert corpo["fonte"] == "catalogo"
    assert corpo["libro_id"] == str(_LIBRO_ID)
    assert corpo["anno_di_edizione"] is False
    assert corpo["descrizione_fonte"] == "wikipedia"
    # L'identificativo da cui si è arrivati resta nella risposta.
    assert corpo["volume_id"] == _VOLUME_ID


def test_libro_inesistente(dati: dict[str, Any], authenticated: TestClient) -> None:
    dati["volume"] = None

    assert authenticated.get(f"/schede/google/{_VOLUME_ID}").status_code == 404


def test_scheda_di_catalogo_inesistente(dati: dict[str, Any], authenticated: TestClient) -> None:
    dati["scheda"] = None

    assert authenticated.get(f"/schede/catalogo/{_LIBRO_ID}").status_code == 404


def test_fonte_irraggiungibile_non_e_non_esiste(
    dati: dict[str, Any], authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """503 e non 404: distinzione che l'interfaccia deve poter dichiarare,
    altrimenti chi guarda conclude che il libro non ci sia."""

    async def _cade(volume_id: str) -> google_books.Volume | None:
        raise FonteNonRaggiungibileError("google_books", "quota esaurita")

    monkeypatch.setattr(google_books, "per_identificativo", _cade)

    risposta = authenticated.get(f"/schede/google/{_VOLUME_ID}")

    assert risposta.status_code == 503
    assert risposta.json()["detail"]["error_code"] == "fonte_irraggiungibile"


# --- il parere --------------------------------------------------------------


def test_il_parere_arriva_e_non_viene_salvato(
    dati: dict[str, Any], authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    con_chiave(monkeypatch)
    con_risposta(monkeypatch, risposta_chat({"testo": "Direi di sì, per il ritmo che cerchi."}))

    risposta = authenticated.post(f"/schede/google/{_VOLUME_ID}/parere")

    assert risposta.status_code == 200
    assert risposta.json()["testo"] == "Direi di sì, per il ritmo che cerchi."
    # Nessun campo che suggerisca una risorsa conservata: niente id, niente
    # data. Se un giorno comparissero, la regola 23 avrebbe un secondo
    # posto in cui essere interpretata.
    assert set(risposta.json()) == {"testo"}
    assert dati["salvati"] == []


def test_lanno_di_edizione_non_esce_come_anno_dellopera(
    dati: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Regola del PRD sull'anno: meglio non dirlo che dirlo sbagliato. Il
    2019 della ristampa non deve raggiungere il modello in nessuna forma
    che lo faccia passare per l'anno del romanzo."""
    con_chiave(monkeypatch)
    inviate = con_risposta(
        monkeypatch, risposta_chat({"testo": "Sì, per come costruisce lo spazio."})
    )

    _run(scheda_pubblica_service.parere("t", _USER_ID, "google", _VOLUME_ID, "it"))

    corpo = inviate[0].content.decode()
    assert "2019" not in corpo
    # Ciò che invece deve esserci: il libro su cui si chiede il parere e il
    # profilo di chi lo chiede.
    assert "Il nome della rosa" in corpo
    assert "Il barone rampante" in corpo


def test_a_consenso_revocato_il_parere_non_parte(
    dati: dict[str, Any], authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    con_chiave(monkeypatch)
    inviate = con_risposta(monkeypatch, risposta_chat({"testo": "Mai inviato."}))
    dati["consenso"] = False

    risposta = authenticated.post(f"/schede/google/{_VOLUME_ID}/parere")

    assert risposta.status_code == 409
    assert risposta.json()["detail"]["error_code"] == "consenso_revocato"
    assert inviate == []


def test_il_parere_rispetta_le_ottanta_parole(
    dati: dict[str, Any], authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Regola 20, identica a quella della preview salvata: la scheda
    pubblica non è una porta di servizio per aggirarla."""
    con_chiave(monkeypatch)
    con_risposta(monkeypatch, risposta_chat({"testo": " ".join(["parola"] * 81)}))

    risposta = authenticated.post(f"/schede/google/{_VOLUME_ID}/parere")

    assert risposta.status_code == 503
    assert risposta.json()["detail"]["error_code"] == "modello_non_disponibile"


# --- la cache di Google -----------------------------------------------------


def test_guardare_un_volume_lo_rende_aggiungibile(monkeypatch: pytest.MonkeyPatch) -> None:
    """`POST /libri` ricompone l'opera SOLO dalla cache di processo: se
    aprire una scheda non la riempisse, si potrebbe guardare un libro e poi
    non riuscire ad aggiungerlo."""
    google_books.svuota_cache()
    monkeypatch.setattr(google_books.get_settings(), "google_books_api_key", "prova", raising=False)

    corpo = {"id": _VOLUME_ID, "volumeInfo": {"title": "Il nome della rosa"}}
    originale = httpx.AsyncClient

    def _client(*args: Any, **kwargs: Any) -> httpx.AsyncClient:
        kwargs["transport"] = httpx.MockTransport(lambda _: httpx.Response(200, json=corpo))
        return originale(*args, **kwargs)

    monkeypatch.setattr(google_books.httpx, "AsyncClient", _client)

    assert google_books.opera_dalla_cache(_VOLUME_ID, []) is None

    _run(google_books.per_identificativo(_VOLUME_ID))

    opera = google_books.opera_dalla_cache(_VOLUME_ID, [])
    assert opera is not None
    assert opera.rappresentante.volume_id == _VOLUME_ID


def test_un_volume_che_google_non_conosce(monkeypatch: pytest.MonkeyPatch) -> None:
    """404 dalla fonte non è una fonte irraggiungibile: è un volume che non
    esiste, e chi chiama deve poterlo dire con parole diverse."""
    google_books.svuota_cache()
    monkeypatch.setattr(google_books.get_settings(), "google_books_api_key", "prova", raising=False)
    originale = httpx.AsyncClient

    def _client(*args: Any, **kwargs: Any) -> httpx.AsyncClient:
        kwargs["transport"] = httpx.MockTransport(lambda _: httpx.Response(404))
        return originale(*args, **kwargs)

    monkeypatch.setattr(google_books.httpx, "AsyncClient", _client)

    assert _run(google_books.per_identificativo("non-esiste")) is None
