"""Contratti di `/letture`. Le Letture si aprono/chiudono solo tramite
`PATCH /voci/{id}/stato` (la macchina a stati, docs/adr/0015): non esiste
un POST /letture diretto. L'unica scrittura diretta su questa risorsa in
questa issue è la cancellazione (PRD: "l'Utente può... cancellare ogni
contenuto proprio... Letture aperte per errore", generalizzato dal caso
limite a qualunque Lettura)."""

from typing import Literal

EsitoLettura = Literal["conclusa", "abbandonata"]
