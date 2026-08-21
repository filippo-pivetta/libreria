"""Il worker come processo separato: `python -m app.lavori`.

Esiste anche se oggi il worker gira dentro FastAPI, e non per simmetria:
è la prova eseguibile che "spostarlo fuori è un cambio di entrypoint"
(docs/adr/0016) sia vero e non un'affermazione. Il giorno in cui la CPU
delle conversioni desse fastidio alla latenza dell'API, si mette
`WORKER_ABILITATO=false` sul processo web e si avvia questo: nessun modulo
cambia.
"""

import asyncio
import contextlib
import logging
import signal

from app.lavori.worker import Worker

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


async def _principale() -> None:
    worker = Worker()
    arresto = asyncio.Event()

    loop = asyncio.get_running_loop()
    for segnale in (signal.SIGINT, signal.SIGTERM):
        # add_signal_handler invece di signal.signal: interrompe l'attesa
        # dell'evento senza attraversare il gestore sincrono di Python, che
        # scatterebbe solo al risveglio successivo del loop.
        with contextlib.suppress(NotImplementedError):
            loop.add_signal_handler(segnale, arresto.set)

    await worker.avvia()
    logging.getLogger("app.lavori").info("Worker avviato come processo separato.")
    try:
        await arresto.wait()
    finally:
        await worker.ferma()
        logging.getLogger("app.lavori").info("Worker fermato.")


if __name__ == "__main__":
    asyncio.run(_principale())
