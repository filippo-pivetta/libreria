"""Contratti di `GET /metriche` e `GET /utenti/{id}/metriche` (issue #7,
PRD entità "Metrica di lettura"). Stesso payload per le proprie metriche
e per quelle di un collegato — solo la sorgente dei dati cambia."""

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
    # Quante delle Letture concluse nell'anno erano già cominciate
    # nell'anno precedente. `ha_letture_a_cavallo_anno` resta il flag che
    # decide SE mostrare la spiegazione; questo è il numero che le
    # permette di essere al plurale quando serve, invece del singolare
    # fisso che la frase portava prima.
    letture_a_cavallo_anno: int

    # ------------------------------------------------------------------
    # Aggiunte dal ridisegno degli Annali (design-frontend.md §14).
    # Nessuna migrazione e nessuna query nuova: tutte escono dalle stesse
    # tre letture che il servizio faceva già.
    # ------------------------------------------------------------------

    # Somma degli incrementi per mese, dodici numeri da gennaio a
    # dicembre, sempre di lunghezza 12 anche per un anno in corso (i mesi
    # non ancora arrivati valgono zero, e il frontend li distingue da un
    # mese a zero perché conosce `giorni_trascorsi`). È la stessa somma
    # di `pagine_lette`, solo non collassata: sum(pagine_per_mese) ==
    # pagine_lette per costruzione.
    pagine_per_mese: list[int]
    # Date distinte in cui esiste almeno un Avanzamento con incremento
    # positivo. Misura l'abitudine, non il volume: un Avanzamento a
    # incremento zero (una correzione, una pagina riscritta uguale) non
    # è un giorno di lettura.
    giorni_con_lettura: int
    # Giorni dell'anno già trascorsi al momento della richiesta, nel fuso
    # Europa centrale: l'anno intero per un anno passato, il giorno
    # dell'anno per quello corrente. Senza questo denominatore
    # `giorni_con_lettura` non si può leggere, perché 118 su un anno
    # finito e 118 su otto mesi non dicono la stessa cosa.
    giorni_trascorsi: int
    # Media dei voti delle Voci concluse nell'anno che UN voto ce l'hanno,
    # arrotondata a un decimale; `None` quando nessuna è votata (mai 0,0,
    # che sarebbe un voto pessimo invece di un'assenza).
    voto_medio: float | None
    # Quante Voci concluse nell'anno portano un voto: il denominatore
    # esplicito di `voto_medio` (design-frontend.md §14, "ogni numero
    # porta accanto il suo limite").
    libri_votati: int
    # Distribuzione dei voti in cinque caselle, da una a cinque stelle.
    # I mezzi voti si arrotondano per eccesso alla stella superiore: la
    # distribuzione è un istogramma a cinque colonne, non la scala a
    # dieci passi con cui si vota.
    voti_per_stella: list[int]
    # Letture con esito 'abbandonata' chiuse nell'anno. Non entrano in
    # `libri_finiti` (regola 13) ma le loro pagine sì, come quelle di
    # qualunque altra Lettura: sono pagine che l'Utente ha letto.
    abbandoni: int
    # Durata in giorni di una Lettura conclusa nell'anno, dalla data di
    # inizio a quella di fine, estremi inclusi (una Lettura cominciata e
    # conclusa in giornata dura un giorno, non zero). `None` quando
    # nell'anno non si è conclusa alcuna Lettura.
    durata_media_giorni: int | None
    durata_massima_giorni: int | None
    # Il titolo della Lettura più lunga, nella lingua dell'interfaccia
    # quando esiste una variante. `None` insieme a `durata_massima_giorni`.
    durata_massima_titolo: str | None
    # Libri finiti nell'anno senza `pagine_adottate` sulla Voce: lo scarto
    # che rende concreto il limite su `pagine_lette`. Zero significa che
    # la somma è completa e il limite non va nemmeno scritto.
    libri_senza_pagine: int
