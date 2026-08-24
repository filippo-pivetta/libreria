"""Accesso dati grezzo per la scheda di un libro che non è (ancora) in
libreria — la carta che si apre dai risultati di ricerca prima di
aggiungere (docs/design-frontend.md §13).

Repository a sé e non funzioni in più dentro `voce_repository`: qui si
legge il LIBRO, dato di catalogo condiviso, senza passare da una Voce.
Ogni query di `voce_repository` parte invece da `voce_di_libreria`, ed è
esattamente ciò che questa scheda non può fare — il libro che si sta
guardando non è di nessuno.

Passa comunque dal client dell'Utente e non dalla connessione diretta:
il catalogo è leggibile a ogni autenticato per grant esplicito (`grant
select on table public.libro to authenticated`), e la RLS deve restare
l'unico punto in cui vive la regola "chi vede cosa" (ADR 0001).
"""

from typing import Any, cast
from uuid import UUID

from supabase import Client

_SELECT = (
    "id, titolo_canonico, anno_prima_pubblicazione, anno_dedotto, "
    "lingua_originale, lingua_dedotta, pagine_mediane_catalogo, "
    "copertina_miniatura_path, copertina_grande_path, copertina_colore_dominante, "
    "copertina_colore_dominante_scuro, copertina_stato, "
    "variante_titolo(lingua, titolo), "
    "libro_autore(ordine, autore:autore_id(nome_canonico)), "
    "libro_genere(genere:genere_id(id, genere_etichetta(lingua, etichetta))), "
    "libro_descrizione(lingua, testo, fonte)"
)


def _titolo(libro: dict[str, Any], lingua: str) -> str:
    """La variante nella lingua dell'interfaccia, con ripiego sul titolo
    canonico — l'ordine che il PRD fissa per il titolo mostrato, lo stesso
    della RPC `cerca_libri` da cui arriva la riga dei risultati. Un titolo
    che cambia fra la riga e la carta che ci si apre dietro sarebbe letto
    come un libro diverso."""
    for variante in libro.get("variante_titolo") or []:
        if variante.get("lingua") == lingua and variante.get("titolo"):
            return str(variante["titolo"])
    return str(libro.get("titolo_canonico") or "")


def _autori(libro: dict[str, Any]) -> list[str]:
    righe = sorted(
        (r for r in libro.get("libro_autore") or [] if r.get("autore")),
        key=lambda r: r.get("ordine") or 0,
    )
    return [str(r["autore"]["nome_canonico"]) for r in righe]


def _generi(libro: dict[str, Any], lingua: str) -> list[dict[str, str]]:
    generi = []
    for riga in libro.get("libro_genere") or []:
        genere = riga.get("genere")
        if not genere:
            continue
        etichetta = next(
            (
                e["etichetta"]
                for e in genere.get("genere_etichetta") or []
                if e.get("lingua") == lingua
            ),
            None,
        )
        if etichetta:
            generi.append({"id": str(genere["id"]), "etichetta": str(etichetta)})
    return generi


def _descrizione(libro: dict[str, Any], lingua: str) -> tuple[str | None, str | None]:
    """Testo e fonte, solo nella lingua dell'interfaccia: mai un ripiego su
    un'altra (design-frontend.md §9 — una trama nella lingua sbagliata non
    assolve alla stessa funzione)."""
    riga = next(
        (d for d in libro.get("libro_descrizione") or [] if d.get("lingua") == lingua), None
    )
    if riga is None:
        return None, None
    return str(riga["testo"]), str(riga.get("fonte") or "") or None


def scheda(client: Client, libro_id: UUID, lingua: str) -> dict[str, Any] | None:
    """La scheda di catalogo di un libro, senza alcuna Voce."""
    risposta = (
        client.table("libro").select(_SELECT).eq("id", str(libro_id)).maybe_single().execute()
    )
    if risposta is None or not risposta.data:
        return None

    libro = cast("dict[str, Any]", risposta.data)
    descrizione, fonte = _descrizione(libro, lingua)
    return {
        "libro_id": libro["id"],
        "titolo": _titolo(libro, lingua),
        "titolo_canonico": libro.get("titolo_canonico"),
        "autori": _autori(libro),
        "anno_prima_pubblicazione": libro.get("anno_prima_pubblicazione"),
        "anno_dedotto": bool(libro.get("anno_dedotto")),
        "lingua_originale": libro.get("lingua_originale"),
        "pagine": libro.get("pagine_mediane_catalogo"),
        "generi": _generi(libro, lingua),
        "descrizione": descrizione,
        "descrizione_fonte": fonte,
        "copertina_path": libro.get("copertina_grande_path")
        or libro.get("copertina_miniatura_path"),
        "copertina_colore_dominante": libro.get("copertina_colore_dominante"),
        "copertina_colore_dominante_scuro": libro.get("copertina_colore_dominante_scuro"),
        "copertina_stato": libro.get("copertina_stato") or "assente",
    }


def etichette_generi(client: Client, generi: list[str], lingua: str) -> list[dict[str, str]]:
    """Le etichette dell'elenco chiuso per gli id dati.

    Serve al ramo esterno della scheda: lì i generi non esistono ancora in
    database — la scheda non è nata — e si deducono al volo dai soggetti di
    catalogo con `mappatura_generi.mappa`, che restituisce id. Le etichette
    restano lette dalla tabella che il Manutentore gestisce fuori banda
    (ADR 0005), mai duplicate nel codice.
    """
    if not generi:
        return []
    risposta = (
        client.table("genere_etichetta")
        .select("genere_id, etichetta")
        .in_("genere_id", generi)
        .eq("lingua", lingua)
        .execute()
    )
    per_id = {
        str(r["genere_id"]): str(r["etichetta"])
        for r in cast("list[dict[str, Any]]", risposta.data or [])
    }
    # Nell'ordine deciso dalla mappatura (il più corrispondente per primo),
    # non in quello in cui il database li restituisce.
    return [{"id": g, "etichetta": per_id[g]} for g in generi if g in per_id]
