"""Risoluzione della lingua dell'interfaccia lato server (issue #34), dalla
stessa `Accept-Language` che il browser manda da solo con ogni richiesta —
nessuna preferenza indipendente da quella che il frontend applica con
next-intl (`frontend/src/lib/lingua.ts`, stesso algoritmo in TypeScript, da
tenere allineato a mano: le due implementazioni vivono in runtime diversi e
non condividono codice).

Sostituisce le costanti `_LINGUA_INTERFACCIA = "it"` finora duplicate in
`voce_repository.py`, `metriche_service.py` ed `export_service.py`: la
scelta fra le varianti di titolo/descrizione/etichetta di genere già salvate
nelle due lingue diventa un parametro reale, iniettato dai router con
`Depends(lingua_interfaccia)` e propagato esplicitamente fino al punto in
cui si sceglie la riga — mai un valore fisso.

`app/repositories/preview_repository.py` resta fuori: la sua
`LINGUA_INTERFACCIA` alimenta il contesto mandato al modello per le funzioni
assistite (preview personalizzata, sintesi, suggerimenti), non un testo
mostrato direttamente nell'interfaccia — un problema distinto, non ancora
nel perimetro di questa issue.
"""

from fastapi import Header

LINGUE_INTERFACCIA = ("it", "en")
LINGUA_PREDEFINITA = "it"


def _lingua_da_intestazione(valore: str | None) -> str:
    """La prima lingua fra quelle richieste (in ordine di preferenza,
    qualità `;q=` inclusa) che compare fra le due supportate; altrimenti
    l'italiano — stesso comportamento della costante che sostituisce."""
    if not valore:
        return LINGUA_PREDEFINITA

    voci: list[tuple[float, str]] = []
    for parte in valore.split(","):
        pezzi = parte.strip().split(";q=")
        codice = pezzi[0].strip().split("-")[0].lower()
        try:
            qualita = float(pezzi[1]) if len(pezzi) > 1 else 1.0
        except ValueError:
            qualita = 0.0
        voci.append((qualita, codice))

    for _, codice in sorted(voci, key=lambda voce: voce[0], reverse=True):
        if codice in LINGUE_INTERFACCIA:
            return codice
    return LINGUA_PREDEFINITA


async def lingua_interfaccia(accept_language: str | None = Header(default=None)) -> str:
    """Dipendenza FastAPI: `Depends(lingua_interfaccia)` in un router."""
    return _lingua_da_intestazione(accept_language)
