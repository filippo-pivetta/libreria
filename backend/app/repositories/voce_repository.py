"""Accesso dati grezzo a `voce_di_libreria` (+ `libro` incorporato per lo
scaffale/la scheda del libro).

Il client passato in ingresso opera sempre con l'identità dell'utente
(`get_user_client`, docs/adr/0001): le RLS restano l'unico punto in cui
vive la regola "chi vede cosa". Nessuna regola di dominio qui — la
macchina a stati e i vincoli tra righe vivono nel database (trigger/RPC,
supabase/migrations/20260820065144_ciclo_di_lettura.sql, docs/adr/0015).
"""

from datetime import date
from typing import Any, cast
from uuid import UUID

from supabase import Client

_SELECT_BASE = (
    "id, utente_id, libro_id, stato, pagine_adottate, voto, creato_at, "
    "aggiornato_at, voce_di_libreria_privata(nota_intenzione), "
    "recensione(id), insight(id)"
)

# I campi del Libro che servono a disegnare un dorso sullo scaffale.
# NON comprendono la descrizione dell'opera: lo scaffale non la disegna
# in nessun punto (`components/libreria/` non la nomina), e chiederla
# significava trascinare un paragrafo per ogni volume della libreria
# dentro la risposta della home, a ogni apertura. Sta in
# `_CAMPI_LIBRO_CON_DESCRIZIONE` sotto, che la scheda del libro usa.
_CAMPI_LIBRO_SCAFFALE = (
    "id, titolo_canonico, "
    "anno_prima_pubblicazione, anno_dedotto, lingua_originale, lingua_dedotta, "
    "copertina_miniatura_path, copertina_grande_path, copertina_colore_dominante, "
    "copertina_colore_dominante_scuro, "
    "copertina_stato, libro_autore(ordine, autore:autore_id(id, nome_canonico)), "
    "libro_genere(genere:genere_id(id, genere_etichetta(lingua, etichetta)))"
)

_CAMPI_LIBRO_CON_DESCRIZIONE = (
    f"{_CAMPI_LIBRO_SCAFFALE}, libro_descrizione(lingua, testo, riformulata)"
)

_SELECT_CON_LIBRO = f"{_SELECT_BASE}, libro:libro_id ({_CAMPI_LIBRO_SCAFFALE})"

_SELECT_CON_LIBRO_E_DESCRIZIONE = f"{_SELECT_BASE}, libro:libro_id ({_CAMPI_LIBRO_CON_DESCRIZIONE})"

# GET /voci: come sopra, più la pagina raggiunta nella Lettura aperta (se
# c'è), per il filo di avanzamento della fascia "in corso" dello scaffale
# (design-frontend.md §7, regola 8). Alias diverso da quello usato in
# _SELECT_DETTAGLIO sotto (che incorpora l'intero storico, non solo la
# Lettura aperta): due alias distinti sulla stessa tabella lettura non
# confliggono in PostgREST.
_SELECT_LISTA = f"{_SELECT_CON_LIBRO}, lettura_aperta:lettura(avanzamento(pagina))"

# GET /voci/{id}: come sopra, con l'intero storico delle Letture — ciascuna
# con i propri avanzamenti — annidato via le FK composite verso
# voce_di_libreria(id, utente_id) e lettura(id, utente_id) (schema
# esistente, 20260818115830). PostgREST le risolve senza bisogno di una
# seconda chiamata (verificato manualmente contro PostgREST locale).
_SELECT_DETTAGLIO = (
    f"{_SELECT_CON_LIBRO_E_DESCRIZIONE}, "
    "letture:lettura (id, data_inizio, data_fine, anno_fine, esito, creato_at, "
    "avanzamenti:avanzamento (id, pagina, data, generato_automaticamente, creato_at))"
)


def _appiattisci_autori(voce: dict[str, Any]) -> dict[str, Any]:
    """PostgREST restituisce gli autori imbustati nella riga di giunzione
    (`libro.libro_autore[].autore`), non come lista piatta: `autori` è la
    forma che `LibroEssenziale` (app/schemas/voci.py) si aspetta.
    Trasformazione puramente strutturale, non una regola di dominio —
    l'ordine (`ordine`, regola 18 del PRD sul peso ripartito tra più
    autori) arriva già corretto dalla query, qui non si riordina nulla."""
    libro = voce.get("libro")
    if libro is not None:
        libro["autori"] = [
            riga["autore"] for riga in libro.pop("libro_autore", []) if riga.get("autore")
        ]
    return voce


def _appiattisci_generi(voce: dict[str, Any], lingua: str) -> dict[str, Any]:
    """PostgREST restituisce i generi imbustati nella riga di giunzione
    (`libro.libro_genere[].genere.genere_etichetta[]`), con l'etichetta di
    ogni lingua annidata: qui si sceglie quella dell'interfaccia (issue #34,
    risolta dal chiamante con `app.core.lingua.lingua_interfaccia`, mai un
    valore fisso) e si scarta il resto. `genere_etichetta` copre ogni id
    dell'elenco chiuso (migrazione 20260821120000), quindi un genere
    assegnato ha sempre un'etichetta nella lingua dell'interfaccia."""
    libro = voce.get("libro")
    if libro is not None:
        generi = []
        for riga in libro.pop("libro_genere", []):
            genere = riga.get("genere")
            if not genere:
                continue
            etichetta = next(
                (
                    e["etichetta"]
                    for e in genere.get("genere_etichetta", [])
                    if e.get("lingua") == lingua
                ),
                None,
            )
            if etichetta:
                generi.append({"id": genere["id"], "etichetta": etichetta})
        libro["generi"] = generi
    return voce


def _appiattisci_descrizione(voce: dict[str, Any], lingua: str) -> dict[str, Any]:
    """Solo la descrizione nella lingua dell'interfaccia, mai un ripiego
    su un'altra (design-frontend.md §9: "nessun ripiego su un'altra
    lingua se manca in quella dell'interfaccia — a differenza del titolo,
    una trama nella lingua sbagliata non assolve alla stessa funzione")."""
    libro = voce.get("libro")
    if libro is not None:
        descrizioni = libro.pop("libro_descrizione", [])
        riga = next((d for d in descrizioni if d.get("lingua") == lingua), None)
        libro["descrizione"] = riga["testo"] if riga else None
        libro["descrizione_riformulata"] = bool(riga["riformulata"]) if riga else False
    return voce


def _appiattisci_nota_intenzione(voce: dict[str, Any]) -> dict[str, Any]:
    """`nota_intenzione` vive in `voce_di_libreria_privata` (RLS chiusa al
    solo proprietario — fix sicurezza 20260820221500), incorporata da
    PostgREST come relazione uno-a-uno. `None` sia quando non è mai stata
    scritta sia quando la RLS della tabella privata la nasconde a un
    collegato attivo: nel secondo caso è il comportamento voluto, non un
    dato mancante."""
    privata = voce.pop("voce_di_libreria_privata", None)
    if isinstance(privata, list):
        privata = privata[0] if privata else None
    voce["nota_intenzione"] = privata["nota_intenzione"] if privata else None
    return voce


def _appiattisci_conteggi(voce: dict[str, Any]) -> dict[str, Any]:
    """`ha_recensione`/`numero_insight` (issue #5): un conteggio non è un
    elenco o un'anteprima ai fini della regola 10 del PRD, quindi nessun
    gating spoiler qui — il testo vero e proprio di recensione/insight è
    esposto solo da `voci_service.dettaglio`, con le sue regole di
    visibilità."""
    voce["ha_recensione"] = bool(voce.pop("recensione", None))
    voce["numero_insight"] = len(voce.pop("insight", None) or [])
    return voce


def _con_pagina_corrente(voce: dict[str, Any]) -> dict[str, Any]:
    """Estrae la pagina dell'ultimo avanzamento della sola Lettura aperta
    (se c'è) in un campo piatto `pagina_corrente`, e rimuove la busta
    `lettura_aperta` di PostgREST. La pagina più alta è per costruzione
    l'ultima raggiunta: la monotonia è garantita da trg_avanzamento_valida,
    non serve ordinare per data."""
    letture_aperte = voce.pop("lettura_aperta", [])
    avanzamenti = letture_aperte[0]["avanzamento"] if letture_aperte else []
    ultimo = max((a["pagina"] for a in avanzamenti), default=None)
    voce["pagina_corrente"] = ultimo
    return voce


def get_by_libro(client: Client, libro_id: UUID, utente_id: UUID) -> dict[str, Any] | None:
    """La propria Voce per un Libro, se esiste. Regola 11 (al più una
    Voce per Libro) è garantita dal vincolo
    `uq_voce_di_libreria_utente_libro`: qui si interroga soltanto, per
    decidere se `POST /voci` deve creare o restituire l'esistente.

    Filtro esplicito su `utente_id`, non solo la RLS: da quando la RLS di
    `voce_di_libreria` permette anche a un collegato attivo di leggere
    questa riga (issue #3), una `.eq("libro_id", ...)` senza filtro
    troverebbe anche la Voce del collegato per lo stesso libro — al
    minimo un dedup sbagliato (creerebbe la propria come se non
    esistesse mai, o viceversa la scambierebbe per esistente), al
    peggio un errore da `.maybe_single()` se entrambe le righe sono
    visibili insieme."""
    response = (
        client.table("voce_di_libreria")
        .select(_SELECT_BASE)
        .eq("libro_id", str(libro_id))
        .eq("utente_id", str(utente_id))
        .maybe_single()
        .execute()
    )
    if response is None:
        return None
    return _appiattisci_conteggi(
        _appiattisci_nota_intenzione(cast("dict[str, Any]", response.data))
    )


def create(client: Client, utente_id: UUID, libro_id: UUID) -> dict[str, Any]:
    """Nasce sempre con stato 'da_leggere' (default di colonna): nessun
    altro campo è scrivibile all'aggiunta (PRD, comportamento #3)."""
    response = (
        client.table("voce_di_libreria")
        .insert({"utente_id": str(utente_id), "libro_id": str(libro_id)})
        .select(_SELECT_BASE)
        .execute()
    )
    rows = cast("list[dict[str, Any]]", response.data)
    return _appiattisci_conteggi(_appiattisci_nota_intenzione(rows[0]))


def list_con_libro(client: Client, utente_id: UUID, lingua: str) -> list[dict[str, Any]]:
    """La libreria di `utente_id`, con Libro incorporato: filtro
    esplicito, non la sola RLS (issue #3 — la RLS permette anche a un
    collegato attivo di leggere queste righe, quindi ometterlo
    mescolerebbe qui la propria libreria con quella di un collegato).
    Riusata identica sia per `GET /voci` (con `utente_id` = chi chiama)
    sia per `GET /utenti/{id}/voci` (con l'id del collegato, dopo che
    il chiamante ha già verificato il collegamento attivo). `lingua`:
    issue #34, vedi `_appiattisci_generi`."""
    response = (
        client.table("voce_di_libreria")
        .select(_SELECT_LISTA)
        .eq("utente_id", str(utente_id))
        .order("ordine", foreign_table="libro.libro_autore")
        .is_("lettura_aperta.esito", "null")
        .execute()
    )
    righe = cast("list[dict[str, Any]]", response.data)
    return [
        # Nessun `_appiattisci_descrizione` qui, a differenza di
        # `get_dettaglio`: la query dello scaffale non chiede
        # `libro_descrizione`, quindi non c'è nulla da appiattire.
        _con_pagina_corrente(
            _appiattisci_conteggi(
                _appiattisci_nota_intenzione(_appiattisci_generi(_appiattisci_autori(riga), lingua))
            )
        )
        for riga in righe
    ]


def get_dettaglio(client: Client, voce_id: UUID, lingua: str) -> dict[str, Any] | None:
    """La Voce con Libro e l'intero storico delle Letture (ciascuna con i
    propri avanzamenti), per la scheda del libro. Letture più recenti per
    prime, avanzamenti di ciascuna in ordine cronologico (design-
    frontend.md §10: "raggruppati per lettura", le letture più vecchie su
    una carta di luminanza diversa). `lingua`: issue #34, vedi
    `_appiattisci_generi`."""
    response = (
        client.table("voce_di_libreria")
        .select(_SELECT_DETTAGLIO)
        .eq("id", str(voce_id))
        .order("ordine", foreign_table="libro.libro_autore")
        .order("data_inizio", desc=True, foreign_table="letture")
        .order("data", foreign_table="letture.avanzamenti")
        .maybe_single()
        .execute()
    )
    if response is None:
        return None
    voce = _appiattisci_autori(cast("dict[str, Any]", response.data))
    return _appiattisci_conteggi(
        _appiattisci_nota_intenzione(
            _appiattisci_descrizione(_appiattisci_generi(voce, lingua), lingua)
        )
    )


def update_pagine_adottate(
    client: Client, voce_id: UUID, pagine_adottate: int | None
) -> dict[str, Any] | None:
    """Il tetto/adeguamento dell'avanzamento finale (regola 14, PRD "il
    totale è un tetto, non un moltiplicatore") sono imposti dal trigger
    `trg_voce_pagine_adottate`, non da questa funzione."""
    response = (
        client.table("voce_di_libreria")
        .update({"pagine_adottate": pagine_adottate})
        .eq("id", str(voce_id))
        .select(_SELECT_BASE)
        .execute()
    )
    rows = cast("list[dict[str, Any]]", response.data)
    return _appiattisci_conteggi(_appiattisci_nota_intenzione(rows[0])) if rows else None


def update_voto(client: Client, voce_id: UUID, voto: float | None) -> dict[str, Any] | None:
    """Nessun trigger coinvolto (a differenza di pagine_adottate): il
    vincolo 1-5 è un CHECK dichiarativo sulla colonna, non un vincolo tra
    righe."""
    response = (
        client.table("voce_di_libreria")
        .update({"voto": voto})
        .eq("id", str(voce_id))
        .select(_SELECT_BASE)
        .execute()
    )
    rows = cast("list[dict[str, Any]]", response.data)
    return _appiattisci_conteggi(_appiattisci_nota_intenzione(rows[0])) if rows else None


def update_nota_intenzione(
    client: Client, voce_id: UUID, utente_id: UUID, nota_intenzione: str | None
) -> dict[str, Any] | None:
    """`nota_intenzione` vive in `voce_di_libreria_privata` (fix sicurezza
    20260820221500), mai in `voce_di_libreria`: un upsert su questa
    tabella, non un update sulla riga condivisa. La FK composita verso
    voce_di_libreria(id, utente_id) rifiuta la scrittura (23503) se
    `voce_id` non è già di `utente_id` — tradotto in eccezione di dominio
    dal service layer, come per `LibroInesistenteError`."""
    client.table("voce_di_libreria_privata").upsert(
        {
            "voce_id": str(voce_id),
            "utente_id": str(utente_id),
            "nota_intenzione": nota_intenzione,
        },
        on_conflict="voce_id",
    ).execute()
    response = (
        client.table("voce_di_libreria")
        .select(_SELECT_BASE)
        .eq("id", str(voce_id))
        .maybe_single()
        .execute()
    )
    if response is None:
        return None
    return _appiattisci_conteggi(
        _appiattisci_nota_intenzione(cast("dict[str, Any]", response.data))
    )


def delete(client: Client, voce_id: UUID) -> bool:
    """Cancella l'intera Voce (issue #33, PRD: "cancellare... la Voce
    intera"). True se una riga è stata cancellata, False se non trovata o
    non di proprietà (RLS la rende indistinguibile, stesso trattamento di
    `lettura_repository.delete`).

    Nessuna cancellazione esplicita di letture/avanzamenti/recensione/
    insight/nota di intenzione/preview/indici semantici qui: la cascata
    dello schema (`voce_di_libreria_id_utente_id` referenziata con
    `on delete cascade` da ogni tabella figlia, transitiva fino a
    `indice_semantico` via `insight`/`recensione`) la fa da sola —
    esattamente la stessa cascata già collaudata da `fondi_libro` e da
    `me_service.elimina_account`. Nessuna migrazione nuova serviva: RLS
    (`voce_di_libreria_delete_owner`) e cascata esistevano già."""
    response = client.table("voce_di_libreria").delete().eq("id", str(voce_id)).execute()
    rows = cast("list[dict[str, Any]]", response.data)
    return len(rows) > 0


def cambia_stato(
    client: Client,
    voce_id: UUID,
    nuovo_stato: str,
    data: date | None,
    precisione: str = "giorno",
    anno_fine: int | None = None,
) -> dict[str, Any]:
    """Unico canale di scrittura per `stato`: la RPC `cambia_stato_voce`
    valida la matrice di transizione e applica i suoi effetti collaterali
    (docs/adr/0015). La funzione non è SETOF e restituisce
    `public.voce_di_libreria` come tipo composito: da quando
    `nota_intenzione` è uscita da quella tabella (fix sicurezza
    20260820221500) il tipo non la porta più, quindi va recuperata con
    una query separata, non incorporabile nella RPC stessa."""
    client.rpc(
        "cambia_stato_voce",
        {
            "p_voce_id": str(voce_id),
            "p_nuovo_stato": nuovo_stato,
            "p_data": data.isoformat() if data is not None else None,
            "p_precisione": precisione,
            "p_anno_fine": anno_fine,
        },
    ).execute()
    response = (
        client.table("voce_di_libreria")
        .select(_SELECT_BASE)
        .eq("id", str(voce_id))
        .single()
        .execute()
    )
    return _appiattisci_conteggi(
        _appiattisci_nota_intenzione(cast("dict[str, Any]", response.data))
    )
