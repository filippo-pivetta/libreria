"""Test per /utenti: isolati sia dalla verifica JWT (dependency
override) sia da Supabase (utenti_service monkeypatchato), stesso
pattern di test_voci.py."""

import asyncio
from collections.abc import Iterator
from typing import Any
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.core.security import get_current_user
from app.main import app
from app.schemas.auth import AuthenticatedUser
from app.services import metriche_service, utenti_service

_USER_ID = UUID("00000000-0000-0000-0000-000000000001")
_ALTRO_ID = UUID("00000000-0000-0000-0000-000000000002")

_MEMBRO: dict[str, Any] = {
    "id": str(_ALTRO_ID),
    "nome_utente": "altra_persona",
    "stato_relazione": "attiva",
    "richiesta_ricevuta": False,
    "collegamento_id": "00000000-0000-0000-0000-0000000000c1",
}

_VOCE: dict[str, Any] = {
    "id": "00000000-0000-0000-0000-0000000000a1",
    "utente_id": str(_ALTRO_ID),
    "libro_id": "00000000-0000-0000-0000-0000000000b1",
    "stato": "da_leggere",
    "pagine_adottate": None,
    "voto": None,
    "nota_intenzione": None,
    "creato_at": "2026-08-20T00:00:00Z",
    "aggiornato_at": "2026-08-20T00:00:00Z",
}

_LIBRO: dict[str, Any] = {
    "id": "00000000-0000-0000-0000-0000000000b1",
    "titolo_canonico": "Prova",
    "anno_prima_pubblicazione": 1980,
    "anno_dedotto": False,
    "lingua_originale": "it",
    "lingua_dedotta": False,
    "generi": [],
    "descrizione": None,
    "descrizione_riformulata": False,
    # URL firmati e non percorsi interni: il bucket è privato (PRD regola
    # 6) e un percorso da solo non apre nulla. `copertina_stato` è ciò che
    # lo scaffale osserva mentre il recupero è in corso.
    "copertina_miniatura_url": None,
    "copertina_grande_url": None,
    "copertina_colore_dominante": None,
    "copertina_colore_dominante_scuro": None,
    "copertina_stato": "assente",
    "autori": [],
}


@pytest.fixture
def authenticated(client: TestClient) -> Iterator[TestClient]:
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        id=_USER_ID, email="ignorata@example.com", access_token="test-token"
    )
    try:
        yield client
    finally:
        del app.dependency_overrides[get_current_user]


# --- GET /utenti -------------------------------------------------------


def test_get_utenti_returns_three_groups(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_elenco(
        access_token: str, self_id: UUID, cerca: str | None = None
    ) -> dict[str, list[dict[str, Any]]]:
        assert access_token == "test-token"
        assert self_id == _USER_ID
        assert cerca is None
        return {"richieste_ricevute": [], "collegati": [_MEMBRO], "altri": []}

    monkeypatch.setattr(utenti_service, "elenco_membri", _fake_elenco)

    response = authenticated.get("/utenti")

    assert response.status_code == 200
    body = response.json()
    assert body["collegati"][0]["stato_relazione"] == "attiva"
    assert body["collegati"][0]["richiesta_ricevuta"] is False
    assert body["collegati"][0]["collegamento_id"] == "00000000-0000-0000-0000-0000000000c1"
    # Nessun conteggio totale dei membri: quanti siano gli iscritti non è
    # un'informazione che l'elenco debba dare. `elenco_completo` non lo è:
    # è un booleano, dice "c'è tutto" o "manca qualcosa" e mai quanti.
    assert set(body) == {"richieste_ricevute", "collegati", "altri", "elenco_completo"}


def test_get_utenti_passa_la_ricerca_al_servizio(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    visto: dict[str, Any] = {}

    async def _fake_elenco(
        access_token: str, self_id: UUID, cerca: str | None = None
    ) -> dict[str, list[dict[str, Any]]]:
        visto["cerca"] = cerca
        return {"richieste_ricevute": [], "collegati": [], "altri": []}

    monkeypatch.setattr(utenti_service, "elenco_membri", _fake_elenco)

    assert authenticated.get("/utenti", params={"cerca": "mar"}).status_code == 200
    assert visto["cerca"] == "mar"


def test_get_utenti_rifiuta_una_ricerca_smisurata(authenticated: TestClient) -> None:
    """Una query lunga arbitraria finirebbe comunque in un ILIKE con due
    caratteri jolly: il tetto sta sulla rotta, non a valle."""
    response = authenticated.get("/utenti", params={"cerca": "x" * 65})
    assert response.status_code == 422


def test_get_utenti_requires_authentication(client: TestClient) -> None:
    response = client.get("/utenti")

    assert response.status_code == 401


# --- GET /utenti/{id}/voci ----------------------------------------------


def test_get_utente_voci_returns_dettaglio_con_utente_e_voci(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_libreria_di(
        access_token: str, self_id: UUID, utente_id: UUID, lingua: str
    ) -> dict[str, Any]:
        assert utente_id == _ALTRO_ID
        return {
            "utente": {"id": str(_ALTRO_ID), "nome_utente": "altra_persona"},
            "voci": [{**_VOCE, "libro": _LIBRO}],
        }

    monkeypatch.setattr(utenti_service, "libreria_di", _fake_libreria_di)

    response = authenticated.get(f"/utenti/{_ALTRO_ID}/voci")

    assert response.status_code == 200
    body = response.json()
    assert body["utente"]["nome_utente"] == "altra_persona"
    assert len(body["voci"]) == 1


def test_get_utente_voci_returns_404_when_utente_inesistente(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_libreria_di(
        access_token: str, self_id: UUID, utente_id: UUID, lingua: str
    ) -> dict[str, Any]:
        raise utenti_service.UtenteInesistenteError

    monkeypatch.setattr(utenti_service, "libreria_di", _fake_libreria_di)

    response = authenticated.get(f"/utenti/{_ALTRO_ID}/voci")

    assert response.status_code == 404


def test_get_utente_voci_returns_403_when_non_collegato(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_libreria_di(
        access_token: str, self_id: UUID, utente_id: UUID, lingua: str
    ) -> dict[str, Any]:
        raise utenti_service.NonCollegatoError

    monkeypatch.setattr(utenti_service, "libreria_di", _fake_libreria_di)

    response = authenticated.get(f"/utenti/{_ALTRO_ID}/voci")

    assert response.status_code == 403
    assert response.json()["detail"]["error_code"] == "non_collegato"


def test_get_utente_voci_requires_authentication(client: TestClient) -> None:
    response = client.get(f"/utenti/{_ALTRO_ID}/voci")

    assert response.status_code == 401


# --- GET /utenti/{id}/metriche (issue #7) --------------------------------

_METRICHE: dict[str, Any] = {
    "anno": 2026,
    "anno_minimo": 2024,
    "anno_massimo": 2026,
    "libri_finiti": 5,
    "riletture": 0,
    "pagine_lette": 1200,
    "autori_piu_letti": [],
    "generi_principali": [],
    "libri_senza_genere": 0,
    "ha_letture_a_cavallo_anno": False,
    "letture_a_cavallo_anno": 0,
    "pagine_per_mese": [0] * 12,
    "giorni_con_lettura": 0,
    "giorni_trascorsi": 234,
    "voto_medio": None,
    "libri_votati": 0,
    "voti_per_stella": [0, 0, 0, 0, 0],
    "abbandoni": 0,
    "durata_media_giorni": None,
    "durata_massima_giorni": None,
    "durata_massima_titolo": None,
    "libri_senza_pagine": 0,
    "pagine_senza_giorno": 0,
    "libri_finiti_senza_giorno": 0,
}


def test_get_utente_metriche_returns_payload(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_metriche_di(
        access_token: str, self_id: UUID, utente_id: UUID, anno: int | None, lingua: str
    ) -> dict[str, Any]:
        assert self_id == _USER_ID
        assert utente_id == _ALTRO_ID
        assert anno == 2025
        return {**_METRICHE, "anno": 2025}

    monkeypatch.setattr(utenti_service, "metriche_di", _fake_metriche_di)

    response = authenticated.get(f"/utenti/{_ALTRO_ID}/metriche?anno=2025")

    assert response.status_code == 200
    assert response.json()["anno"] == 2025


def test_get_utente_metriche_returns_404_when_utente_inesistente(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_metriche_di(
        access_token: str, self_id: UUID, utente_id: UUID, anno: int | None, lingua: str
    ) -> dict[str, Any]:
        raise utenti_service.UtenteInesistenteError

    monkeypatch.setattr(utenti_service, "metriche_di", _fake_metriche_di)

    response = authenticated.get(f"/utenti/{_ALTRO_ID}/metriche")

    assert response.status_code == 404


def test_get_utente_metriche_returns_403_when_non_collegato(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_metriche_di(
        access_token: str, self_id: UUID, utente_id: UUID, anno: int | None, lingua: str
    ) -> dict[str, Any]:
        raise utenti_service.NonCollegatoError

    monkeypatch.setattr(utenti_service, "metriche_di", _fake_metriche_di)

    response = authenticated.get(f"/utenti/{_ALTRO_ID}/metriche")

    assert response.status_code == 403
    assert response.json()["detail"]["error_code"] == "non_collegato"


def test_get_utente_metriche_returns_422_on_anno_futuro(
    authenticated: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _fake_metriche_di(
        access_token: str, self_id: UUID, utente_id: UUID, anno: int | None, lingua: str
    ) -> dict[str, Any]:
        raise metriche_service.AnnoFuturoError

    monkeypatch.setattr(utenti_service, "metriche_di", _fake_metriche_di)

    response = authenticated.get(f"/utenti/{_ALTRO_ID}/metriche?anno=2999")

    assert response.status_code == 422
    assert response.json()["detail"]["error_code"] == "anno_futuro"


def test_get_utente_metriche_requires_authentication(client: TestClient) -> None:
    response = client.get(f"/utenti/{_ALTRO_ID}/metriche")

    assert response.status_code == 401


# --- utenti_service.elenco_membri: i tre gruppi ------------------------
#
# Il contratto di GET /utenti è cambiato deliberatamente (istanza non più
# di poche decine di persone): questi non sono test corretti per far
# passare l'implementazione, sono i test di regole nuove — nessun
# conteggio totale, tetto solo sugli sconosciuti, e mai un tetto su ciò
# che nasce da una relazione.
#
# `asyncio.run` e non un marcatore async: la suite non ha né
# pytest-asyncio né il plugin anyio, e una dipendenza in più per cinque
# test non si giustifica.


@pytest.fixture
def servizio_isolato(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    """Isola `elenco_membri` da Supabase: nessun client vero, i due
    repository sostituiti da funzioni che restituiscono ciò che il test
    decide e registrano gli argomenti ricevuti."""
    from app.repositories import collegamento_repository, utente_repository

    stato: dict[str, Any] = {"collegamenti": [], "sconosciuti": [], "chiamate": []}

    monkeypatch.setattr(utenti_service, "get_user_client", lambda _token: object())
    monkeypatch.setattr(
        collegamento_repository,
        "list_per_utente",
        lambda _client, _self_id: stato["collegamenti"],
    )

    def _cerca(
        _client: Any, _self_id: UUID, query: str | None, limite: int, soglia: float
    ) -> list[dict[str, Any]]:
        stato["chiamate"].append({"query": query, "limite": limite, "soglia": soglia})
        return stato["sconosciuti"]

    monkeypatch.setattr(utente_repository, "cerca_membri", _cerca)
    return stato


def _collegamento(nome: str, stato: str, richiesto_da_me: bool, id_: str) -> dict[str, Any]:
    return {
        "id": id_,
        "stato": stato,
        "richiesto_da_me": richiesto_da_me,
        "altro": {"id": f"00000000-0000-0000-0000-0000000000{id_}", "nome_utente": nome},
    }


def _elenco(cerca: str | None = None) -> dict[str, list[dict[str, Any]]]:
    return asyncio.run(utenti_service.elenco_membri("t", _USER_ID, cerca))


def test_elenco_divide_in_tre_gruppi(servizio_isolato: dict[str, Any]) -> None:
    servizio_isolato["collegamenti"] = [
        _collegamento("giulio", "attiva", False, "c1"),
        _collegamento("marta", "in_attesa", False, "c2"),
        _collegamento("dario", "in_attesa", True, "c3"),
    ]
    servizio_isolato["sconosciuti"] = [
        {"id": "00000000-0000-0000-0000-0000000000d1", "nome_utente": "anna"}
    ]

    risultato = _elenco()

    assert [m["nome_utente"] for m in risultato["collegati"]] == ["giulio"]
    assert [m["nome_utente"] for m in risultato["richieste_ricevute"]] == ["marta"]
    # La richiesta inviata sta in cima ad `altri`, non in un gruppo suo: è
    # la stessa persona in un altro stato, non un'altra specie di riga.
    assert [m["nome_utente"] for m in risultato["altri"]] == ["dario", "anna"]
    # Senza `collegamento_id` l'elenco potrebbe mostrare ritira/interrompi
    # ma non eseguirli: le rotte di /collegamenti lavorano sull'id della
    # relazione, non su quello della persona.
    assert risultato["altri"][0]["collegamento_id"] == "c3"
    assert risultato["altri"][1]["collegamento_id"] is None
    assert risultato["richieste_ricevute"][0]["richiesta_ricevuta"] is True


def test_elenco_non_espone_alcun_totale(servizio_isolato: dict[str, Any]) -> None:
    assert set(_elenco()) == {"richieste_ricevute", "collegati", "altri", "elenco_completo"}


def test_ricerca_troppo_corta_non_interroga_l_anagrafica(
    servizio_isolato: dict[str, Any],
) -> None:
    """Una lettera sola restituirebbe una fetta arbitraria dell'elenco a
    ogni battuta: è enumerazione travestita da ricerca."""
    servizio_isolato["collegamenti"] = [_collegamento("giulio", "attiva", False, "c1")]

    risultato = _elenco(cerca="g")

    assert servizio_isolato["chiamate"] == []
    assert risultato["altri"] == []
    # I gruppi che sono già dati di chi guarda restano comunque filtrati.
    assert [m["nome_utente"] for m in risultato["collegati"]] == ["giulio"]


def test_ricerca_filtra_anche_i_propri_collegati(servizio_isolato: dict[str, Any]) -> None:
    servizio_isolato["collegamenti"] = [
        _collegamento("giulio", "attiva", False, "c1"),
        _collegamento("chiara", "attiva", False, "c2"),
    ]

    risultato = _elenco(cerca="CHI")

    assert [m["nome_utente"] for m in risultato["collegati"]] == ["chiara"]
    assert servizio_isolato["chiamate"][0]["query"] == "CHI"
    # Una riga in più del tetto: è la sentinella che dice se il tetto ha
    # tagliato qualcosa (vedi `test_elenco_completo_*` sotto).
    assert servizio_isolato["chiamate"][0]["limite"] == utenti_service.LIMITE_ELENCO + 1
    assert servizio_isolato["chiamate"][0]["soglia"] == utenti_service.SOGLIA_SOMIGLIANZA


def test_ricerca_di_soli_spazi_vale_come_nessuna_ricerca(
    servizio_isolato: dict[str, Any],
) -> None:
    _elenco(cerca="   ")
    assert servizio_isolato["chiamate"][0]["query"] is None


def _sconosciuti(quanti: int) -> list[dict[str, Any]]:
    return [
        {"id": f"00000000-0000-0000-0000-{i:012d}", "nome_utente": f"lettore{i}"}
        for i in range(quanti)
    ]


def test_elenco_completo_quando_ci_stanno_tutti(servizio_isolato: dict[str, Any]) -> None:
    """Il caso normale di un'istanza a cerchia ristretta: chi riceve la
    risposta ha davanti tutti i nomi, e la ricerca può restare nel
    browser invece di diventare una richiesta per ogni battuta."""
    servizio_isolato["sconosciuti"] = _sconosciuti(12)

    risultato = _elenco()

    assert risultato["elenco_completo"] is True
    assert len(risultato["altri"]) == 12


def test_elenco_incompleto_quando_il_tetto_taglia(servizio_isolato: dict[str, Any]) -> None:
    """La riga in più non deve mai uscire: serve solo a sapere che c'era."""
    servizio_isolato["sconosciuti"] = _sconosciuti(utenti_service.LIMITE_ELENCO + 1)

    risultato = _elenco()

    assert risultato["elenco_completo"] is False
    assert len(risultato["altri"]) == utenti_service.LIMITE_ELENCO


def test_una_ricerca_non_e_mai_un_elenco_completo(servizio_isolato: dict[str, Any]) -> None:
    """Con una ricerca attiva si sta guardando un sottoinsieme: dichiararlo
    completo farebbe credere a chi lo riceve di poter smettere di chiedere."""
    servizio_isolato["sconosciuti"] = _sconosciuti(3)

    risultato = _elenco(cerca="lettore")

    assert risultato["elenco_completo"] is False


def test_ricerca_troppo_corta_non_dichiara_l_elenco_completo(
    servizio_isolato: dict[str, Any],
) -> None:
    """L'anagrafica non viene interrogata affatto: non si è visto niente,
    quindi non si può dire di aver visto tutto."""
    risultato = _elenco(cerca="l")

    assert servizio_isolato["chiamate"] == []
    assert risultato["elenco_completo"] is False
