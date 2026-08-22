"""Il limitatore di frequenza, in un modulo suo perché anche i router
possano applicarlo.

Stava dentro `create_app()` come variabile locale, dove serviva solo il
limite globale per IP. Un limite più stretto su una singola route richiede
il decoratore `@limiter.limit(...)`, che ha bisogno dell'oggetto: da qui
l'estrazione.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])
"""Rete di sicurezza generica per richiesta e per IP (issue #11)."""

LIMITE_CATALOGHI_ESTERNI = "30/minute"
"""Più stretto del globale sulla sola ricerca esterna, perché è l'unico
endpoint che consuma una quota a pagamento e con un tetto giornaliero. Il
campo di ricerca chiama a ogni pausa nella digitazione: senza un limite
proprio, una manciata di ricerche insistenti brucerebbe la quota di tutti.
Trenta al minuto sta largo per una persona che digita e stretto per un
ciclo impazzito."""

LIMITE_FUNZIONI_ASSISTITE = "10/minute"
"""Sulle funzioni assistite personali (ricerca semantica, preview): ogni
richiesta è una chiamata al fornitore di modelli, che il PRD dichiara
essere "l'unica voce di costo variabile" del sistema e lascia
esplicitamente senza tetto di spesa ("il controllo è manuale, fuori dal
prodotto"). Questo non è un tetto di spesa — non conta né token né euro,
e non contraddice quella scelta: è la stessa rete di sicurezza contro il
ciclo impazzito che LIMITE_CATALOGHI_ESTERNI mette sulla quota di Google,
tarata più stretta perché una preview costa più di una ricerca e nessuno
la invoca dieci volte al minuto scrivendo."""
