"""Data odierna nel fuso dell'Europa centrale.

Il PRD impone che "il giorno, l'anno e il concetto di 'futuro' si valutano
sul fuso orario dell'Europa centrale, uguale per tutti gli Utenti
indipendentemente da dove si trovino" — mai il fuso di sessione del server
(UTC su Supabase/Postgres di default, AGENTS.md). Le migrazioni SQL
applicano già la regola lato database (`(now() at time zone
'Europe/Rome')::date`, vedi i commenti su `lettura.data_inizio` e
`avanzamento.data`); questo modulo è l'equivalente lato Python per la
logica che, come le metriche (issue #7), non passa da un trigger — anno
corrente e "anno futuro non selezionabile".
"""

from datetime import date, datetime
from zoneinfo import ZoneInfo

_EUROPA_CENTRALE = ZoneInfo("Europe/Rome")


def oggi_europa_centrale() -> date:
    return datetime.now(_EUROPA_CENTRALE).date()
