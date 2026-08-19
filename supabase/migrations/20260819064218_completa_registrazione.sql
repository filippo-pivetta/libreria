-- Completamento dell'account dopo l'invito del Manutentore (ADR 0013).
--
-- Il Manutentore invita per email (fuori banda, ADR 0007); l'Utente,
-- aprendo il link, imposta la propria password e sceglie il proprio
-- nome_utente, accettando nello stesso passaggio l'informativa. Le righe
-- di utente e utente_privato devono nascere insieme, con l'identità
-- dell'Utente (ADR 0001): questa funzione le crea in una sola transazione
-- invece di due chiamate separate da PostgREST, che non sarebbero
-- atomiche tra loro.

-- Difesa in profondità sul valore scelto dall'Utente: il backend valida
-- già nome_utente prima di chiamare la funzione, ma la colonna accetta
-- scritture dirette via RLS (policy utente_insert_owner), quindi il
-- vincolo minimo va imposto anche qui.
alter table public.utente
  add constraint chk_utente_nome_utente_non_vuoto
  check (btrim(nome_utente) <> '' and length(nome_utente) <= 40);

create function public.completa_registrazione(p_nome_utente text)
returns table (
  id uuid,
  nome_utente text,
  consenso_elaborazione_assistita boolean,
  consenso_aggiornato_at timestamptz,
  informativa_accettata_at timestamptz
)
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- security invoker, non definer: le due insert restano soggette alle
  -- policy RLS esistenti (utente_insert_owner, utente_privato_insert_owner,
  -- entrambe auth.uid() = id) — la funzione dà atomicità, non un
  -- privilegio in più. Un secondo tentativo dello stesso utente fallisce
  -- sul vincolo di chiave primaria di utente (23505); un nome_utente già
  -- in uso fallisce su uq_utente_nome_utente (23505 anch'esso, ma su un
  -- altro vincolo) — il chiamante li distingue dal nome del constraint.
  insert into public.utente (id, nome_utente)
  values (auth.uid(), p_nome_utente);

  -- L'informativa si considera accettata nello stesso istante in cui
  -- l'Utente completa la registrazione (PRD: "Al primo accesso l'Utente
  -- accetta l'informativa"); il consenso all'elaborazione assistita parte
  -- dal proprio default (acceso), senza bisogno di specificarlo qui.
  insert into public.utente_privato (utente_id, informativa_accettata_at)
  values (auth.uid(), now());

  return query
    select u.id, u.nome_utente, up.consenso_elaborazione_assistita,
           up.consenso_aggiornato_at, up.informativa_accettata_at
    from public.utente u
    join public.utente_privato up on up.utente_id = u.id
    where u.id = auth.uid();
end;
$$;

comment on function public.completa_registrazione(text) is
  'Crea insieme utente e utente_privato per chi chiama (auth.uid(), mai un id passato dal client), registrando l''accettazione dell''informativa. Security invoker: soggetta alle stesse RLS di un insert diretto, dà solo atomicità tra le due tabelle. Un secondo tentativo o un nome_utente già in uso falliscono con una violazione di unicità (23505) su constraint diversi.';

grant execute on function public.completa_registrazione(text) to authenticated;
