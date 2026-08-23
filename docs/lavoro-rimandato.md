# Lavoro rimandato

Punti di design non ancora costruiti e senza priorità per aprire un'issue dedicata adesso.
Le voci con un'issue propria sono tracciate lì, non qui.

## Azioni rapide dal volume

Registrare un avanzamento o cambiare stato con un tocco lungo (mobile) senza aprire la scheda del
libro. Con la copertina vera lo spazio libero sul volume è ridotto rispetto al vecchio dorso, il
gesto va ridisegnato da zero. Oggi il volume è solo un link alla scheda.

## Chiuso nella sessione UI

- Interfaccia bilingue (#34): le stringhe sono state estratte in `frontend/src/messaggi/it.ts`
  con chiavi stabili — restava il framework e l'inglese. Completato in una sessione successiva
  (23 agosto 2026): `next-intl`, cataloghi `frontend/messages/{it,en}.json`, backend allineato
  sulla stessa `Accept-Language` (`backend/app/core/lingua.py`). Il resto (estrazione completa,
  numeri non ancora sensibili alla lingua, contenuto assistito) è tracciato in #40.
- Il comando sulla luce, la barra di navigazione in fondo su mobile, i tre canali di
  messaggi e la riscrittura degli errori: vedi `docs/design-frontend.md` §3, §5, §8, §19.

## Issue aperte per lavoro non ancora costruito

- Acquisizione di una citazione da foto — [#32](https://github.com/filippo-pivetta/libreria/issues/32)
- Cancellazione della Voce di libreria intera — [#33](https://github.com/filippo-pivetta/libreria/issues/33)
- Rito di apertura (View Transitions) — [#35](https://github.com/filippo-pivetta/libreria/issues/35)
- Interfaccia bilingue, il resto del lavoro dopo il framework — [#40](https://github.com/filippo-pivetta/libreria/issues/40)
- URL delle pagine tutte in inglese, oggi miste con l'italiano — [#41](https://github.com/filippo-pivetta/libreria/issues/41)
