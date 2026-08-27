"""Raccoglie da Open Library una lista di opere da seminare nel catalogo.

Due rami, perche' nessuna singola classifica di Open Library da' da sola
una lista sensata:

  A. `language:ita` ordinato per readinglog — opere popolari che hanno
     almeno un'edizione italiana. E' il ramo principale: su un'istanza
     italiana un libro senza edizione italiana serve a meno.
  B. `*:*` ordinato per numero di edizioni — il canone, cioe' le opere
     ristampate centinaia di volte. Da solo fa entrare atlanti e
     raccolte di leggi, quindi si filtra con una soglia di readinglog.
"""

import json
import time
import urllib.parse
import urllib.request

UA = "Montaigne/0.1 (https://github.com/filippo-pivetta/libreria) python-urllib"
BASE = "https://openlibrary.org/search.json"
CAMPI = "key,title,author_name,first_publish_year,edition_count,readinglog_count,language"
PER_PAGINA = 100
PAUSA = 0.8  # Open Library: 3 req/s a chi si identifica. Stiamo largo.


def pagina(q, sort, page):
    url = (
        BASE
        + "?"
        + urllib.parse.urlencode(
            {"q": q, "sort": sort, "limit": PER_PAGINA, "page": page, "fields": CAMPI}
        )
    )
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for tentativo in range(3):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.load(r).get("docs", [])
        except Exception as e:
            if tentativo == 2:
                print(f"    ! pagina {page} persa: {e}")
                return []
            time.sleep(3 * (tentativo + 1))
    return []


def raccogli(q, sort, pagine, etichetta):
    fuori = []
    for p in range(1, pagine + 1):
        docs = pagina(q, sort, p)
        fuori.extend(docs)
        print(f"  {etichetta} pagina {p}/{pagine}: {len(docs)} (totale {len(fuori)})")
        if not docs:
            break
        time.sleep(PAUSA)
    return fuori


print("Ramo A — popolari con edizione italiana")
a = raccogli("language:ita", "readinglog", 18, "A")
print("Ramo B — canone per numero di edizioni")
b = raccogli("*:*", "editions", 12, "B")

with open("grezzo.json", "w") as f:
    json.dump({"a": a, "b": b}, f)
print(f"\nGrezzo: ramo A {len(a)}, ramo B {len(b)}")
