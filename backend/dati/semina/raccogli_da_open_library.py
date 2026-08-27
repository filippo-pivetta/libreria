"""Raccoglie da Open Library una lista di opere da seminare nel catalogo.

Due rami, perche' nessuna singola classifica di Open Library da' da sola
una lista sensata:

  A. `language:ita` ordinato per readinglog — opere popolari che hanno
     almeno un'edizione italiana. E' il ramo principale: su un'istanza
     italiana un libro senza edizione italiana serve a meno.
  B. `*:*` ordinato per numero di edizioni — il canone, cioe' le opere
     ristampate centinaia di volte. Da solo fa entrare atlanti, agende e
     libri da colorare, quindi si filtra con una soglia di readinglog.

Va eseguito con il venv del backend attivo e un `.env` leggibile: le
intestazioni arrivano da `app.cataloghi.agente`, che legge
`CONTATTO_OPERATORE` dalle impostazioni.

    python3 backend/dati/semina/raccogli_da_open_library.py
"""

import json
import time
from typing import Any

import httpx

from app.cataloghi.agente import intestazioni

BASE = "https://openlibrary.org/search.json"
CAMPI = "key,title,author_name,first_publish_year,edition_count,readinglog_count,language"
PER_PAGINA = 100
PAUSA = 0.8
"""Open Library concede 3 richieste al secondo a chi si identifica e 1 a
chi resta anonimo (app/cataloghi/agente.py). Stiamo sotto anche il limite
anonimo: questo script fa trenta richieste in tutto e non ha alcuna
fretta, mentre farsi limitare a meta' raccolta significa ricominciare."""


def pagina(cliente: httpx.Client, q: str, sort: str, numero: int) -> list[dict[str, Any]]:
    for tentativo in range(3):
        try:
            risposta = cliente.get(
                BASE,
                params={"q": q, "sort": sort, "limit": PER_PAGINA, "page": numero, "fields": CAMPI},
            )
            risposta.raise_for_status()
            docs = risposta.json().get("docs", [])
            return list(docs)
        except (httpx.HTTPError, ValueError) as errore:
            if tentativo == 2:
                print(f"    ! pagina {numero} persa: {errore}")
                return []
            time.sleep(3 * (tentativo + 1))
    return []


def raccogli(
    cliente: httpx.Client, q: str, sort: str, pagine: int, etichetta: str
) -> list[dict[str, Any]]:
    fuori: list[dict[str, Any]] = []
    for numero in range(1, pagine + 1):
        docs = pagina(cliente, q, sort, numero)
        fuori.extend(docs)
        print(f"  {etichetta} pagina {numero}/{pagine}: {len(docs)} (totale {len(fuori)})")
        if not docs:
            break
        time.sleep(PAUSA)
    return fuori


def main() -> None:
    # `httpx` e non `urllib`: e' gia' la dipendenza con cui tutti i client
    # di `app/cataloghi` parlano con le fonti, e non conosce lo schema
    # `file://` — che e' il motivo per cui `p/default` di Semgrep segnala
    # ogni `urllib.request.urlopen` con un URL costruito a runtime.
    with httpx.Client(headers=intestazioni(), timeout=90.0, follow_redirects=True) as cliente:
        print("Ramo A — popolari con edizione italiana")
        a = raccogli(cliente, "language:ita", "readinglog", 18, "A")
        print("Ramo B — canone per numero di edizioni")
        b = raccogli(cliente, "*:*", "editions", 12, "B")

    with open("grezzo.json", "w") as f:
        json.dump({"a": a, "b": b}, f)
    print(f"\nGrezzo: ramo A {len(a)}, ramo B {len(b)}")


if __name__ == "__main__":
    main()
