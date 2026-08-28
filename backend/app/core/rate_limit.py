"""Il limitatore di frequenza, in un modulo suo perché anche i router
possano applicarlo.

Stava dentro `create_app()` come variabile locale, dove serviva solo il
limite globale per IP. Un limite più stretto su una singola route richiede
il decoratore `@limiter.limit(...)`, che ha bisogno dell'oggetto: da qui
l'estrazione.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request


def indirizzo_chiamante(request: Request) -> str:
    """L'indirizzo di chi ha fatto la richiesta, non quello del proxy.

    In produzione l'app sta dietro il proxy di Fly: `request.client` è
    l'indirizzo del proxy, uguale per tutti, e senza questa funzione i
    limiti qui sotto sarebbero un unico secchio condiviso da chiunque —
    una persona sola potrebbe esaurirli per tutte le altre.

    Si legge `Fly-Client-IP` e non `X-Forwarded-For` perché il proxy
    sovrascrive la prima e si limita ad accodarsi alla seconda: un client
    che mandasse un `X-Forwarded-For` di sua invenzione potrebbe cambiare
    secchio a ogni richiesta, cioè aggirare il limite. Fuori da Fly
    l'intestazione non c'è e si ricade sull'indirizzo della connessione,
    che in locale è già quello giusto.
    """
    indirizzo = request.headers.get("Fly-Client-IP")
    return indirizzo.strip() if indirizzo else get_remote_address(request)


# I tre limiti sotto sono stati alzati (28 agosto 2026) quando l'istanza è
# tornata a essere a cerchia ristretta: erano tarati su un'istanza aperta,
# dove il secchio per IP difende gli altri da uno sconosciuto. Fra amici
# quell'ipotesi cade, e i numeri di prima li toccava per primo chi usava
# l'app come va usata — la ricerca semantica dieci volte di fila mentre si
# cerca un ricordo, una sessione di aggiunte una dopo l'altra.
#
# Restano, e restano per IP, per l'unica ragione che valeva anche prima e
# vale ancora: un ciclo impazzito — un `useEffect` senza dipendenze, una
# scheda lasciata aperta che riprova all'infinito — brucia una quota
# esterna in pochi minuti, e nessuno se ne accorge finché non arriva il
# conto. Non sono un tetto di spesa (non contano né token né euro, PRD
# regola 19), sono un fusibile.

limiter = Limiter(key_func=indirizzo_chiamante, default_limits=["600/minute"])
"""Rete di sicurezza generica per richiesta e per IP (issue #11).

Seicento al minuto sono dieci al secondo sostenuti: nessuna navigazione
umana ci arriva nemmeno aprendo pagine a raffica, un ciclo impazzito sì."""

LIMITE_CATALOGHI_ESTERNI = "120/minute"
"""Sulla sola ricerca esterna, l'unico endpoint che consuma una quota a
pagamento e con un tetto giornaliero. Il campo di ricerca chiama a ogni
pausa nella digitazione: due al secondo restano sopra qualunque velocità
di battitura, e sotto il ritmo di un ciclo."""

LIMITE_FUNZIONI_ASSISTITE = "60/minute"
"""Sulle funzioni assistite personali (ricerca semantica, preview,
suggerimenti, sintesi): ogni richiesta è una chiamata al fornitore di
modelli, che il PRD dichiara essere "l'unica voce di costo variabile" del
sistema e lascia esplicitamente senza tetto di spesa ("il controllo è
manuale, fuori dal prodotto").

Dieci al minuto erano pochi per la ricerca semantica, che si usa a
tentativi: si riscrive la domanda, si cambia una parola, si riprova. È
esattamente il gesto che il vecchio limite interrompeva."""
