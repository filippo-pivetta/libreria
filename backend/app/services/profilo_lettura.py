"""Il profilo di gusto del richiedente, in tre gruppi con ruoli diversi
(issue #27, "suggerimenti di lettura a profilo").

Estratto da `suggerimenti_service` il 24 agosto 2026 perché serve a due
funzioni, non a una: la preview personalizzata ("me lo consigli?", issue
#6) usava fino a quel giorno una fonte più povera e con un bug —
`preview_repository.storico_personale` ordinava per `voce.aggiornato_at`,
una colonna che cambia anche correggendo solo il numero di pagine, invece
che per la vera data di chiusura della Lettura; vedeva solo i libri
`letto`, mai gli abbandoni; e passava insight e recensioni come un pool
piatto senza dire a quale libro appartenessero. Difetti che qui erano già
stati risolti per i suggerimenti (stesso 22 agosto) e non erano mai stati
riportati alla preview. Un lettore che chiede un parere su un libro non
merita un profilo di sé più povero di quello che il sistema usa un clic
più in là per suggerirgli cosa leggere.

**I tre gruppi**, costruiti da `classifica` sui dati grezzi di
`preview_repository.profilo_suggerimenti`:

- **pilastri**: voto ≥ `VOTO_PILASTRO`, di qualsiasi età — il gusto che
  dura nel tempo. Un libro amato dieci anni fa dice ancora chi sei; uno
  tiepido di tre anni fa non dice più niente. Nessuna funzione di
  decadimento sul voto: il PRD non tiene uno storico dei voti
  ("riscrivendoli si perde la versione precedente"), quindi il voto in
  tabella è già il tuo giudizio di oggi, non quello di allora — non c'è
  una deriva da modellare.
- **recenti**: le ultime letture concluse per data di chiusura vera
  (`lettura.data_fine`, non `voce.aggiornato_at` che cambia anche
  correggendo una pagina), qualsiasi voto — dove sei ora, delusioni
  comprese.
- **delusi**: voto ≤ `VOTO_DELUSO` o abbandono, qualsiasi età — cosa
  evitare, non materiale per proporre "altri libri così". Un libro non è
  più invisibile solo perché non ti è piaciuto: prima lo era.

Un libro entra in al più uno dei tre gruppi, con questa priorità:
pilastro prima di deluso prima di recente — un libro amato non deve
comparire due volte solo perché è anche la lettura più recente.
"""

from typing import Any

MASSIMO_PILASTRI = 12
MASSIMO_RECENTI = 12
MASSIMO_DELUSI = 8
"""Tetti sui tre gruppi, non sul totale del profilo: oltre queste decine
il prompt diventa un elenco in cui nessuna preferenza risalta, stessa
ragione di `preview_repository.MASSIMO_TESTI_PROPRI`."""

VOTO_PILASTRO = 4.0
VOTO_DELUSO = 2.5
"""Sopra `VOTO_PILASTRO` un libro è un pilastro; a `VOTO_DELUSO` o sotto
è un deluso; in mezzo (2,5 < voto < 4) un libro non entra in nessuno dei
due gruppi — non abbastanza amato per guidare una proposta, non
abbastanza sgradito per escludere un territorio. Resta comunque negli
esclusi."""


def classifica(
    profilo: list[dict[str, Any]], *, escludi_voce_id: str | None = None
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], set[str]]:
    """Un libro entra in al più uno dei tre gruppi: pilastro prima di
    deluso prima di recente, così un libro amato di recente non compare
    due volte con due ruoli diversi. `esclusi` copre invece **ogni**
    Voce, in qualunque stato — anche quelle non classificate in nessun
    gruppo, e anche quelle "da_leggere": un libro già in coda non va
    riproposto solo perché non è né un pilastro né un deluso.

    `escludi_voce_id`, se dato, toglie dal profilo la Voce con quell'id
    PRIMA di classificare — la preview lo passa con la Voce su cui si sta
    chiedendo il parere, che altrimenti comparirebbe come prova di sé
    stessa (specie se il chiamante ignora la regola del frontend che
    offre il comando solo su "da leggere" e la richiede via API diretta
    su un libro già letto). I suggerimenti non lo passano: non c'è una
    singola Voce a cui la richiesta si riferisce.
    """
    if escludi_voce_id is not None:
        profilo = [r for r in profilo if str(r.get("voce_id")) != escludi_voce_id]

    esclusi = {riga["titolo"].strip().casefold() for riga in profilo if riga["titolo"]}

    pilastri = sorted(
        (r for r in profilo if r["voto"] is not None and r["voto"] >= VOTO_PILASTRO),
        key=lambda r: (r["voto"], r["data_conclusa"] or ""),
        reverse=True,
    )[:MASSIMO_PILASTRI]
    usati = {r["voce_id"] for r in pilastri}

    delusi = sorted(
        (
            r
            for r in profilo
            if r["voce_id"] not in usati
            and (
                (r["voto"] is not None and r["voto"] <= VOTO_DELUSO) or r["stato"] == "abbandonato"
            )
        ),
        key=lambda r: r["data_abbandonata"] or r["data_conclusa"] or "",
        reverse=True,
    )[:MASSIMO_DELUSI]
    usati |= {r["voce_id"] for r in delusi}

    recenti = sorted(
        (r for r in profilo if r["voce_id"] not in usati and r["data_conclusa"]),
        key=lambda r: r["data_conclusa"],
        reverse=True,
    )[:MASSIMO_RECENTI]

    return pilastri, recenti, delusi, esclusi
