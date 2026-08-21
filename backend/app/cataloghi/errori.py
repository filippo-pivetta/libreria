"""Il solo errore che i client dei cataloghi sollevano verso l'alto."""


class FonteNonRaggiungibileError(Exception):
    """La fonte non ha risposto, o ha risposto che non può servire.

    Copre situazioni tecnicamente diverse — rete caduta, timeout, 5xx,
    quota esaurita, chiave assente — perché per chi sta cercando sono la
    stessa cosa: il catalogo non risponde. L'interfaccia deve poterlo
    dichiarare, distinguendolo da "non esiste" (docs/design-frontend.md
    §13: "Fonti irraggiungibili è un altro stato, distinto da 'non
    esiste', altrimenti chi cerca pensa che il libro non ci sia mentre è
    solo il catalogo che non risponde").

    Non è un 500: non è andato storto nulla nel nostro sistema.
    """

    def __init__(self, fonte: str, motivo: str) -> None:
        super().__init__(f"{fonte}: {motivo}")
        self.fonte = fonte
        self.motivo = motivo

    @staticmethod
    def da_httpx(fonte: str, errore: Exception) -> "FonteNonRaggiungibileError":
        """Molte eccezioni di httpx hanno il messaggio vuoto — `ConnectTimeout`
        su tutte — e un log che dice solo "open_library: " non aiuta nessuno
        a capire cosa sia successo. Il nome della classe è l'informazione."""
        motivo = str(errore) or type(errore).__name__
        return FonteNonRaggiungibileError(fonte, motivo)
