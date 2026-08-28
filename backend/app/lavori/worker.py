"""Il ciclo che svuota la coda dei lavori (docs/adr/0016).

Una classe e non un modulo di funzioni, deroga consapevole alla
convenzione dei service: possiede un task, un evento di arresto e una
connessione, e due istanze nello stesso processo sono un errore che
conviene rendere visibile invece che nascondere in variabili di modulo.

Gira dentro il processo FastAPI, avviato dal `lifespan`. Spostarlo in un
processo separato è un cambio di entrypoint e nient'altro: `python -m
app.lavori` con `WORKER_ABILITATO=false` sul processo web. Nessun modulo
di questo pacchetto cambia.
"""

import asyncio
import contextlib
import logging
from datetime import timedelta
from typing import Any

import psycopg
from fastapi.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.lavori.errori import ErroreDefinitivo, ErroreTransitorio
from app.lavori.registro import GESTORI, Gestore
from app.repositories import database, lavoro_repository

logger = logging.getLogger("app.lavori")

MAX_TENTATIVI = 3

ATTESE = (timedelta(seconds=30), timedelta(seconds=120), timedelta(seconds=600))
"""Attesa prima del tentativo successivo, per numero di tentativi già
fatti. Crescente perché la causa più comune di un fallimento transitorio è
una fonte momentaneamente sovraccarica: ripresentarsi subito la peggiora."""

_SOGLIA_ORFANI = timedelta(minutes=10)
"""Oltre questo tempo in `in_corso`, un lavoro si considera abbandonato da
un worker morto. Deve essere largamente superiore al lavoro più lento
(scaricare e convertire una copertina: secondi), altrimenti si
riaccoderebbe un lavoro ancora in corso."""

_CICLI_TRA_RECUPERI = 150


class Worker:
    def __init__(self, intervallo: float | None = None, lotto: int | None = None) -> None:
        settings = get_settings()
        self._intervallo = (
            intervallo if intervallo is not None else settings.worker_intervallo_secondi
        )
        self._lotto = lotto if lotto is not None else settings.worker_lotto
        self._stop = asyncio.Event()
        self._task: asyncio.Task[None] | None = None
        self._connessione: psycopg.Connection[Any] | None = None
        self._cicli = 0

    # --- ciclo di vita -----------------------------------------------------

    async def avvia(self) -> None:
        """Crea il task e ritorna subito: non blocca l'avvio dell'app."""
        if self._task is not None:
            raise RuntimeError("Worker già avviato.")
        self._stop.clear()
        self._task = asyncio.create_task(self._cicla(), name="lavori")

    async def ferma(self, timeout: float = 30.0) -> None:
        self._stop.set()
        if self._task is not None:
            try:
                await asyncio.wait_for(self._task, timeout=timeout)
            except TimeoutError:
                # Il lavoro in corso resta 'in_corso': lo rimette in coda il
                # recuperatore al prossimo avvio. Meglio un riavvio brusco
                # che un arresto appeso, perché uvicorn attende il lifespan.
                self._task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await self._task
            self._task = None
        await run_in_threadpool(self._chiudi_connessione)

    def _chiudi_connessione(self) -> None:
        # Suppress su Exception e non sul solo psycopg.Error: questa
        # funzione è sulla via dello spegnimento, e nulla di ciò che
        # accade qui deve poter impedire all'applicazione di fermarsi.
        # La connessione viene comunque dimenticata subito dopo.
        if self._connessione is not None:
            with contextlib.suppress(Exception):
                self._connessione.close()
            self._connessione = None

    def _connessione_aperta(self) -> psycopg.Connection[Any]:
        """Aperta pigramente, mai in `avvia()`: se il database non è
        raggiungibile all'avvio l'app deve partire lo stesso — l'health
        check esiste per dirlo — non fallire il lifespan."""
        if self._connessione is None or self._connessione.closed:
            self._connessione = database.apri_connessione()
        return self._connessione

    # --- il ciclo ----------------------------------------------------------

    async def _cicla(self) -> None:
        while not self._stop.is_set():
            try:
                svolti = await self.passo()
            except Exception:
                logger.exception("Errore nel ciclo dei lavori; riprovo tra un intervallo.")
                self._chiudi_connessione()
                svolti = 0
            # Se c'era lavoro si riparte subito: una coda che si riempie non
            # deve smaltirsi al ritmo dell'intervallo di attesa.
            if svolti == 0:
                await self._attendi(self._intervallo)

    async def _attendi(self, secondi: float) -> None:
        """Attesa interrompibile. Non `asyncio.sleep`: dormire fino in
        fondo ritarderebbe lo spegnimento di un intervallo intero."""
        with contextlib.suppress(TimeoutError):
            await asyncio.wait_for(self._stop.wait(), timeout=secondi)

    async def passo(self) -> int:
        """Una sola iterazione: recupera gli orfani ogni tanto, prende in
        carico un lotto e lo esegue. Ritorna quanti lavori ha svolto.

        Separata dal ciclo perché è l'unità che i test possono esercitare
        senza far girare nulla a tempo indeterminato.
        """
        connessione = await run_in_threadpool(self._connessione_aperta)

        if self._cicli % _CICLI_TRA_RECUPERI == 0:
            recuperati = await run_in_threadpool(
                lavoro_repository.recupera_orfani, connessione, _SOGLIA_ORFANI
            )
            if recuperati:
                logger.warning("Rimessi in coda %d lavori orfani.", recuperati)
        self._cicli += 1

        lavori = await run_in_threadpool(
            lavoro_repository.prendi_in_carico, connessione, self._lotto
        )
        if not lavori:
            return 0

        # In parallelo e non uno dopo l'altro. Un lavoro è quasi tutto
        # attesa di rete (Google Books, Open Library, OpenAI, il download
        # di una copertina): in serie, l'aggiunta di un solo libro — che
        # ne accoda sette o otto — si smaltiva sommando quelle attese,
        # ed era il tempo in cui la scheda restava senza copertina e
        # senza descrizione. Non serve a reggere più carico: serve a far
        # finire prima la raffica che parte da un singolo gesto.
        #
        # `return_exceptions=True` perché un `gather` che propaga subito
        # NON ferma le altre coroutine: senza, il ciclo chiuderebbe la
        # connessione mentre un lavoro fratello la sta ancora usando. Qui
        # si aspetta che tutti abbiano finito, poi si rilancia il primo
        # errore, e il ciclo si comporta come prima.
        #
        # La connessione è una sola e condivisa: `psycopg.Connection` è
        # thread-safe e serializza da sé le istruzioni, che qui sono
        # scritture brevi di stato (segna_riuscito, rimetti_in_coda).
        esiti = await asyncio.gather(
            *(self._esegui(connessione, lavoro) for lavoro in lavori),
            return_exceptions=True,
        )
        for esito in esiti:
            if isinstance(esito, BaseException):
                raise esito
        return len(lavori)

    async def _esegui(self, connessione: psycopg.Connection[Any], lavoro: dict[str, Any]) -> None:
        tipo = str(lavoro["tipo"])
        gestore = GESTORI.get(tipo)
        if gestore is None:
            # Un tipo senza gestore non è transitorio: nessun numero di
            # tentativi lo farà comparire.
            await run_in_threadpool(
                lavoro_repository.segna_fallito,
                connessione,
                lavoro["id"],
                f"Nessun gestore per il tipo '{tipo}'.",
            )
            return

        payload = dict(lavoro["payload"] or {})
        try:
            await gestore.esegui(payload)
        except ErroreTransitorio as errore:
            await self._dopo_transitorio(connessione, lavoro, gestore, payload, str(errore))
        except ErroreDefinitivo as errore:
            await self._dopo_definitivo(connessione, lavoro, gestore, payload, str(errore))
        except Exception as errore:  # noqa: BLE001
            # Un errore non classificato è un difetto del gestore, non della
            # fonte: si tratta come definitivo, così non gira in cerchio, e
            # si registra con il traceback perché va corretto nel codice.
            logger.exception(
                "Lavoro %s (%s) fallito con un errore non previsto.", lavoro["id"], tipo
            )
            await self._dopo_definitivo(connessione, lavoro, gestore, payload, repr(errore))
        else:
            await run_in_threadpool(lavoro_repository.segna_riuscito, connessione, lavoro["id"])

    async def _dopo_transitorio(
        self,
        connessione: psycopg.Connection[Any],
        lavoro: dict[str, Any],
        gestore: Gestore,
        payload: dict[str, Any],
        errore: str,
    ) -> None:
        tentativi = int(lavoro["tentativi"])
        if tentativi >= MAX_TENTATIVI:
            await self._dopo_definitivo(connessione, lavoro, gestore, payload, errore)
            return
        attesa = ATTESE[min(tentativi - 1, len(ATTESE) - 1)]
        await run_in_threadpool(
            lavoro_repository.rimetti_in_coda, connessione, lavoro["id"], errore, attesa
        )

    async def _dopo_definitivo(
        self,
        connessione: psycopg.Connection[Any],
        lavoro: dict[str, Any],
        gestore: Gestore,
        payload: dict[str, Any],
        errore: str,
    ) -> None:
        # Prima lo stato osservabile, poi la coda: se il processo muore in
        # mezzo, è meglio una scheda già marcata 'fallita' con un lavoro
        # ancora 'in_corso' (che il recuperatore rimetterà in coda) che una
        # coda chiusa e una scheda in attesa per sempre.
        with contextlib.suppress(Exception):
            await gestore.su_fallimento_definitivo(payload, errore)
        await run_in_threadpool(lavoro_repository.segna_fallito, connessione, lavoro["id"], errore)
