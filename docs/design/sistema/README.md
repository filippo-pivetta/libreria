# Il sistema, in due tavole

Riferimento visivo di **gerarchia dei comandi** (`Main.dc.html`) e **scala
tipografica** (`Testo.dc.html`). Non sono la fotografia di una schermata: sono
il vocabolario che ogni schermata eredita, e cambiano molto più di rado di
qualsiasi pagina.

La fonte di verità del design resta [`docs/design-frontend.md`](../../design-frontend.md).
Queste tavole non la sostituiscono: aggiungono l'unica cosa che la prosa non
può fare, cioè far **vedere** la differenza fra 38 px e 44 px, o fra `t-sentenza`
e `t-appunto`. Dove le due divergessero, vince il documento.

## Cos'è successo al resto

Nascono dal canvas del ridisegno della scheda del libro (agosto 2026), che
conteneva anche sei tavole di schermata — prima/dopo, mobile, i quattro stati,
il libro di un collegato, gli insight. Quelle sono state buttate a
implementazione avvenuta: erano artefatti di *decisione*, la decisione è stata
presa e spedita, e il ragionamento è finito in `design-frontend.md`. Un mockup
che diverge dal codice è peggio di nessun mockup — il prossimo che passa non sa
quale dei due sia l'intenzione.

## Aprirle

Sono file [Design Components](https://claude.ai/design): non si aprono nel
browser da soli, si aprono su un canvas. Da Claude Code, `/design` li ri-semina
e pubblica. Il file impacchettato non si committa: è ~2,4 MB di editor, e si
rigenera da questi sorgenti.
