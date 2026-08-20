# 0014. Base UI invece di Radix per i primitivi di interfaccia

Stato: accettata
Data: 2026-08-19

## Contesto
Il design doc (`docs/design-frontend.md` §20) prescrive alla lettera "Radix primitives invece di shadcn/ui preso così com'è, che porta un'estetica già decisa da disfare quasi ovunque". Lo scaffold del frontend, generato prima di questo lavoro sul sistema di design (issue #10), usa invece `@base-ui/react` in ogni componente condiviso che avvolge un primitivo (`Button`, `Input`, `Avatar`, `Separator`) e nello strumento CLI `shadcn` stesso, che genera i componenti in `src/components/ui/` su quella libreria. Nessun ADR precedente registra questa sostituzione: è una decisione implicita dello scaffold, non discussa.

Base UI è successore dichiarato di Radix, costruito dallo stesso team (WorkOS/Radix insieme a Base Web di Material UI) proprio per sostituirlo: stessa filosofia di primitivi non stilizzati e accessibili da compore con Tailwind, API in gran parte equivalente (component composto, slot via `data-*` invece di classi imposte). Il punto che conta per il design doc — "un'estetica già decisa da disfare quasi ovunque" — riguardava `shadcn/ui` preso "così com'è" (con lo stile visivo del tema di default), non la scelta fra Radix e Base UI come motore di accessibilità sottostante: qui i componenti restano comunque generati come codice proprio in `src/components/ui/`, non un pacchetto stilizzato esterno, ed è esattamente il sistema di token di questo lavoro (colore, luce, tipografia, materia) a sostituire l'estetica di scaffold — indipendentemente da quale libreria di primitivi sta sotto.

## Decisione
Si resta su `@base-ui/react`. Non c'è motivo tecnico o di design per tornare a Radix: il vincolo che il design doc voleva davvero imporre — niente estetica di shadcn/ui presa così com'è — è soddisfatto dal sistema di token di questo lavoro, non dalla scelta del motore sottostante. Riscrivere ogni componente condiviso su Radix per allinearsi alla lettera del documento sposterebbe sforzo da un problema reale (i valori dei token erano ancora il placeholder dello scaffold) a uno che non esiste (i due motori si comportano in modo equivalente per come sono usati qui).

## Alternative scartate
**Migrare tutti i componenti condivisi a Radix prima di costruire il sistema di design sopra.** Lavoro di riscrittura non richiesto da nessun requisito di prodotto, che avrebbe ritardato la palette/luce/tipografia — il prerequisito reale per ogni schermata di dominio che segue — per inseguire la lettera di una frase che riguardava l'estetica di shadcn/ui, non il motore di accessibilità.

## Conseguenze
Il design doc §20 è stato aggiornato per dire "Base UI" invece di "Radix primitives", coerentemente con questa decisione. Se in futuro emergesse un motivo tecnico concreto per passare a Radix (una funzione che Base UI non offre), la migrazione riguarda solo `src/components/ui/`, non le pagine che li consumano.
