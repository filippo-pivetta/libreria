"""Il profilo di gusto a tre gruppi (`app/services/profilo_lettura.py`),
estratto il 24 agosto 2026 da `suggerimenti_service` perché la preview
personalizzata lo usa anche lei (issue #6, vedi il docstring del modulo).
Funzione pura, nessun mock necessario.
"""

from typing import Any

from app.services import profilo_lettura


def _voce(
    titolo: str,
    *,
    voce_id: str | None = None,
    stato: str = "letto",
    voto: float | None = None,
    data_conclusa: str | None = None,
    data_abbandonata: str | None = None,
) -> dict[str, Any]:
    return {
        "voce_id": voce_id or f"voce-{titolo}",
        "stato": stato,
        "titolo": titolo,
        "autori": ["Autore Esempio"],
        "generi": ["Classici"],
        "descrizione": None,
        "voto": voto,
        "recensione": None,
        "insight": [],
        "data_conclusa": data_conclusa,
        "data_abbandonata": data_abbandonata,
    }


def test_classifica_pilastri_recenti_delusi() -> None:
    pilastro = _voce("Amato", voto=5.0, data_conclusa="2015-01-01")
    deluso_per_voto = _voce("Deluso", voto=2.0, data_conclusa="2020-01-01")
    abbandonato_senza_voto = _voce(
        "Abbandonato", stato="abbandonato", data_abbandonata="2021-06-01"
    )
    recente_medio = _voce("Recente", voto=3.5, data_conclusa="2026-08-01")
    da_leggere = _voce("In coda", stato="da_leggere")

    pilastri, recenti, delusi, esclusi = profilo_lettura.classifica(
        [pilastro, deluso_per_voto, abbandonato_senza_voto, recente_medio, da_leggere]
    )

    assert [p["titolo"] for p in pilastri] == ["Amato"]
    assert {d["titolo"] for d in delusi} == {"Deluso", "Abbandonato"}
    assert [r["titolo"] for r in recenti] == ["Recente"]
    # Ogni stato entra negli esclusi, anche "da_leggere" e ciò che non è
    # classificato in nessun gruppo.
    assert esclusi == {"amato", "deluso", "abbandonato", "recente", "in coda"}


def test_un_libro_amato_non_compare_anche_fra_i_recenti() -> None:
    """Priorità pilastro > deluso > recente: un libro amato di recente
    ha comunque un solo ruolo."""
    pilastro_recente = _voce("Amato di recente", voto=4.5, data_conclusa="2026-08-01")

    pilastri, recenti, delusi, _ = profilo_lettura.classifica([pilastro_recente])

    assert len(pilastri) == 1
    assert recenti == []
    assert delusi == []


def test_voto_intermedio_non_entra_in_nessun_gruppo() -> None:
    """Fra `VOTO_DELUSO` e `VOTO_PILASTRO` un libro letto ma senza
    Lettura conclusa registrata non guida né una proposta né un
    avvertimento — resta comunque negli esclusi."""
    tiepido = _voce("Tiepido", voto=3.0, data_conclusa=None)

    pilastri, recenti, delusi, esclusi = profilo_lettura.classifica([tiepido])

    assert pilastri == recenti == delusi == []
    assert "tiepido" in esclusi


def test_escludi_voce_id_toglie_la_voce_prima_di_classificare() -> None:
    """Solo la preview lo passa: la Voce su cui si sta chiedendo il
    parere non deve comparire come prova di sé stessa, in nessuno dei tre
    gruppi né fra gli esclusi."""
    pilastro = _voce("Amato", voce_id="v1", voto=5.0, data_conclusa="2020-01-01")
    quella_in_esame = _voce("In esame", voce_id="v2", voto=4.5, data_conclusa="2026-08-01")

    pilastri, recenti, delusi, esclusi = profilo_lettura.classifica(
        [pilastro, quella_in_esame], escludi_voce_id="v2"
    )

    assert [p["titolo"] for p in pilastri] == ["Amato"]
    assert recenti == delusi == []
    assert esclusi == {"amato"}


def test_escludi_voce_id_assente_non_tocca_nulla() -> None:
    """Il valore di default (`None`) non filtra niente: è il caso dei
    suggerimenti, dove non c'è una singola Voce a cui la richiesta si
    riferisce."""
    pilastro = _voce("Amato", voce_id="v1", voto=5.0, data_conclusa="2020-01-01")

    pilastri, _, _, _ = profilo_lettura.classifica([pilastro])

    assert [p["titolo"] for p in pilastri] == ["Amato"]
