"""Contratti di `GET /metriche` e `GET /utenti/{id}/metriche` (issue #7,
PRD entità "Metrica di lettura"). Stesso payload per le proprie metriche
e per quelle di un collegato — solo la sorgente dei dati cambia
(docs/rimandato-annali-collegato.md)."""

from pydantic import BaseModel


class VoceClassificaResponse(BaseModel):
    """Una riga di "autori più letti" o "generi principali": il peso è
    frazionario quando un Libro ha più di un autore/genere (PRD regola
    18, "la somma dei contributi resta pari a un libro") — design-
    frontend.md §14 impone di mostrare i decimali, non arrotondarli a un
    intero."""

    id: str
    nome: str
    peso: float


class MetricheResponse(BaseModel):
    anno: int
    # Intervallo selezionabile (PRD, comportamento #12): dal primo anno
    # con dati all'anno corrente, estremi inclusi. Nessun dato -> i due
    # coincidono sull'anno corrente.
    anno_minimo: int
    anno_massimo: int
    libri_finiti: int
    # Quante delle Letture concluse nell'anno sono una rilettura dello
    # stesso Libro (PRD: "due riletture concluse nello stesso anno
    # contano due" — l'unità è la Lettura, non il Libro).
    riletture: int
    # Somma degli incrementi datati nell'anno (PRD), mai delle pagine
    # raggiunte: include anche le pagine di Letture non ancora concluse
    # o abbandonate (regola 13).
    pagine_lette: int
    autori_piu_letti: list[VoceClassificaResponse]
    generi_principali: list[VoceClassificaResponse]
    # Libri finiti nell'anno senza alcun genere assegnato ("non
    # classificato", PRD): restano fuori da `generi_principali`, quindi
    # la somma dei pesi lì dentro è inferiore a `libri_finiti` esatta-
    # mente di questo scarto (design-frontend.md §14: "lo scarto è
    # dichiarato accanto").
    libri_senza_genere: int
    # Vero se almeno una Lettura conclusa nell'anno è iniziata l'anno
    # prima: governa la spiegazione della divergenza a cavallo d'anno
    # (design-frontend.md §14), mostrata solo quando serve.
    ha_letture_a_cavallo_anno: bool
