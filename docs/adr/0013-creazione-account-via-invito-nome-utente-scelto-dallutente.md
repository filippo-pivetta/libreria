# 0013. Creazione account via invito email, nome utente scelto dall'Utente

Stato: accettata
Data: 2026-08-19

## Contesto
Il PRD originario prevedeva una creazione integralmente manuale: il Manutentore crea utente, credenziali e nome utente sulla piattaforma dati e li consegna fuori dall'app. È il modello più semplice per un'istanza chiusa a invito, ma il passaggio più scomodo è la password: il Manutentore deve inventarne una e farla arrivare al membro con un canale a parte, fuori dal controllo del prodotto. Supabase Auth offre nativamente un meccanismo di invito via email (`auth.admin.inviteUserByEmail`) che elimina quel passaggio senza aprire la registrazione: crea la riga in `auth.users` e manda un'email con un link a uso singolo, verificato empiricamente contro l'istanza locale.

## Decisione
Il Manutentore invita per email, fuori dall'app (ADR 0007 non cambia: resta l'unico modo per far nascere un account, nessuna funzione amministrativa nel prodotto). L'Utente, aprendo il link, completa l'account in un'unica schermata: imposta la propria password, sceglie il proprio nome utente — univoco, non più modificabile una volta scritto — e accetta l'informativa. Le tre cose accadono insieme perché il PRD lega esplicitamente l'accettazione dell'informativa al primo accesso, e senza quell'accettazione la riga `utente_privato` non può nascere; scindere il passaggio avrebbe lasciato l'account in uno stato a metà senza alcuna via per completarlo. L'istanza resta chiusa: nessuna registrazione autonoma, si entra solo da un invito che il Manutentore ha creato.

## Alternative scartate
**Il Manutentore assegna comunque il nome utente all'invito.** Il completamento richiederebbe comunque un passaggio a parte per la password, riproducendo in parte il problema che si voleva risolvere — un dato in più da far coincidere fuori banda. Lasciandolo scegliere all'Utente, tutto il completamento avviene in un solo posto.

**Registrazione completamente autonoma, senza invito.** L'istanza deve restare chiusa: la crescita del gruppo è una decisione del Manutentore, non un evento che chiunque può innescare — coerente con il resto del PRD (Manutentore, Elenco dei membri).

**Scambio del codice via route handler server-side (flusso PKCE).** Scartata dopo verifica empirica: un invito generato lato Admin, senza un client che avvii il flusso, produce un redirect a flusso implicito (token nel frammento dell'URL), non un `code` da scambiare lato server. Il client Supabase del browser resta comunque configurato per PKCE per costruzione (`@supabase/ssr`); i token del link di invito vanno quindi letti dal frammento ed emessi in sessione a mano, una sola volta, nella pagina di completamento.

## Conseguenze
`nome_utente` non è più un dato inserito dal Manutentore: la sua validazione (non vuoto, univocità, lunghezza) diventa superficie applicativa vera, esercitata da un input arbitrario, non solo un vincolo tecnico mai raggiunto dall'esterno. `utente` e `utente_privato` nascono sempre insieme, in una singola transazione lato database (`public.completa_registrazione`), non più "fuori banda dal Manutentore": il commento SQL vicino alle due tabelle è stato aggiornato di conseguenza. Il link di invito è a uso singolo e scade (un'ora in locale, configurabile); un invito scaduto o già usato richiede che il Manutentore ne generi uno nuovo — non esiste un recupero in-app, coerente con l'assenza di ogni funzione amministrativa nel prodotto.
