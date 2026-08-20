-- Consente le mezze stelle sul voto (design doc §9): da smallint 1-5 a
-- numeric(2,1) con vincolo esplicito sui soli decimi ammessi (,0 o ,5),
-- non solo sull'intervallo. `numeric` invece di `real`/`double
-- precision`: valori esatti, niente arrotondamenti in virgola mobile su
-- un dato che viene confrontato per uguaglianza (regola 14, "un secondo
-- clic sullo stesso valore lo cancella").

alter table public.voce_di_libreria
  alter column voto type numeric(2, 1);

alter table public.voce_di_libreria
  drop constraint chk_voce_di_libreria_voto;

alter table public.voce_di_libreria
  add constraint chk_voce_di_libreria_voto
  check (voto is null or (voto between 1 and 5 and (voto * 2) = trunc(voto * 2)));
