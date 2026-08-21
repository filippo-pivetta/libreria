"""Client dei cataloghi bibliografici esterni.

Ogni modulo qui dentro parla con una fonte sola e la usa solo dove è la
migliore, secondo misure fatte sulle API reali (vedi docs/prd.md e i
docstring dei singoli moduli):

    google_books  ricerca mostrata all'Utente, e i suoi identificativi
    open_library  identità dell'opera e mediana delle pagine
    wikidata      lingua originale, anno, titoli multilingua
    wikipedia     descrizione

Nessuno di questi moduli decide nulla: costruiscono richieste, leggono
risposte e restituiscono dati normalizzati. Le decisioni — quale opera è
quale, cosa si scrive in `libro` — stanno in app/services/risoluzione.py.
"""
