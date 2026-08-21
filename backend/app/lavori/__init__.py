"""Lavori in secondo piano (docs/adr/0016).

Quarto punto d'ingresso dell'applicazione, parallelo a `app/routers/`:
`worker.py` sta ai lavori come i router stanno alle richieste HTTP, e i
gestori (`copertine.py`, ...) stanno ai lavori come i service stanno alle
richieste. I repository sono gli stessi di entrambi i mondi.
"""
