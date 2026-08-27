"""L'intestazione `User-Agent` con cui ci si presenta alle fonti esterne.

Un modulo solo perché la stringa era scritta quattro volte (Wikidata,
Wikipedia, copertine, OpenAI) e mancava proprio dove la documentazione la
esige di più — Open Library, che non ne riceveva nessuna e viaggiava con
il `python-httpx/0.28.1` di libreria.

Non è cortesia: è una condizione d'uso documentata, e in entrambi i casi
la sanzione è il blocco.

- **Wikimedia** (Wikidata, Wikipedia) — Policy:User-Agent policy: il
  formato richiesto è `<client>/<versione> (<contatti>) <libreria>` e i
  contatti (URL o email) sono obbligatori. Le richieste non conformi
  possono ricevere 403 con "Scripts should use an informative User-Agent
  string with contact information, or they may be blocked without
  notice", oppure — ed è la parte insidiosa — un generico "Our servers
  are currently experiencing a technical problem", cioè un guasto che si
  legge come guasto della fonte. La stringa precedente («Montaigne/0.1
  (applicazione privata di tracciamento letture)») aveva la forma giusta
  ma nessun contatto dentro le parentesi: era non conforme.
- **Open Library** — openlibrary.org/developers/api: le richieste
  identificate (nome dell'applicazione più un contatto) hanno un limite
  di 3 richieste al secondo, quelle anonime di 1, e la violazione porta a
  "aggressive rate limiting or blocking". La stessa pagina sconsiglia
  esplicitamente gli agenti generici. La catena di risoluzione fa più
  chiamate ravvicinate a Open Library per una sola aggiunta (un ISBN
  dopo l'altro, poi la ricerca per testo): stare sotto 1 req/s non era
  garantito, e il triplo di margine si ottiene presentandosi.

Il contatto è configurabile (`CONTATTO_OPERATORE`) e non scritto qui a
mano: chi ospita un'istanza non è chi ha scritto il codice, e un blocco
notificato all'indirizzo sbagliato è un blocco non notificato. Il default
è l'indirizzo pubblico del progetto, che è un contatto valido secondo
entrambe le policy — mai un'email personale, che finirebbe in chiaro
nell'intestazione di ogni richiesta uscente.
"""

from app.core.config import get_settings

VERSIONE = "0.1"

_CONTATTO_PREDEFINITO = "https://github.com/filippo-pivetta/libreria"


def user_agent() -> str:
    """La stringa da mettere in ogni richiesta verso una fonte esterna."""
    contatto = (get_settings().contatto_operatore or "").strip() or _CONTATTO_PREDEFINITO
    return f"Montaigne/{VERSIONE} ({contatto}) httpx"


def intestazioni() -> dict[str, str]:
    """Le intestazioni comuni a ogni client di catalogo.

    Una funzione e non una costante di modulo: `get_settings()` legge
    l'ambiente, e valutarla all'import legherebbe il valore al momento
    dell'import invece che a quello della richiesta — che è esattamente
    ciò che rende impossibile cambiarlo in un test.
    """
    return {"User-Agent": user_agent()}
