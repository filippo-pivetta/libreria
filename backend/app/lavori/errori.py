"""I due soli esiti negativi di un lavoro, e la differenza tra loro.

La distinzione non è stilistica: decide se si riprova. Il PRD è esplicito
sulle copertine — "Copertina assente alla nascita della scheda: segnaposto
con titolo e autore, **senza ulteriori tentativi automatici**" — ma quella
frase confonde due casi che vanno tenuti separati, altrimenti o si
riprovano all'infinito recuperi che non riusciranno mai, o si rinuncia per
sempre a una copertina persa per un timeout.
"""


class ErroreTransitorio(Exception):
    """La fonte non ha risposto: rete, timeout, 5xx, quota.

    Ha senso riprovare, perché la stessa richiesta domani può riuscire.
    """


class ErroreDefinitivo(Exception):
    """La fonte ha risposto, ed è la risposta a essere terminale.

    Riprovare non cambierebbe nulla, quindi non si riprova nemmeno una
    volta. Da non usare per l'assenza della copertina, che non è un
    fallimento ma un esito: quella si scrive come `copertina_stato =
    'assente'` e il lavoro **riesce**.
    """
