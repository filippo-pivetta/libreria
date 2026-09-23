# Il sistema, in quattro tavole

Riferimento visivo del vocabolario che ogni schermata eredita:

| Tavola | Cosa mostra |
|---|---|
| `Main.dc.html` | **I comandi** — i cinque pesi, e perché un comando non ha la faccia di un rimando |
| `Pastiglie.dc.html` | **Pastiglie e campi** — le tre taglie di capsula, le tre di campo di ricerca |
| `Tocco.dc.html` | **Il tocco** — il bersaglio che non è il riquadro, e le regole di riga su 390px |
| `Testo.dc.html` | **La scala del testo** |

Non sono la fotografia di una schermata: sono il vocabolario che ogni schermata eredita, e
cambiano molto più di rado di qualsiasi pagina.

La fonte di verità del design resta [`docs/design-frontend.md`](../../design-frontend.md) —
**§24 "Comandi, campi e bersagli"** per tre delle quattro tavole. Queste non la sostituiscono:
aggiungono l'unica cosa che la prosa non può fare, cioè far **vedere** la differenza fra 38 px e
44 px, fra `t-sentenza` e `t-appunto`, o fra un riquadro alto 44 e un riquadro alto 30 con un
bersaglio da 44 intorno. Dove le due divergessero, vince il documento.

## Perché solo quattro

Nascono dal canvas del ridisegno della scheda del libro, che conteneva anche sei tavole di
schermata. Quelle sono state buttate a implementazione avvenuta: erano artefatti di *decisione*, la
decisione è stata presa e spedita, e il ragionamento è finito in `design-frontend.md`. Un mockup
che diverge dal codice è peggio di nessun mockup — il prossimo che passa non sa quale dei due sia
l'intenzione.

## Aprirle

Sono file [Design Components](https://claude.ai/design): non si aprono nel browser da soli, si
aprono su un canvas. Da Claude Code, `/design` li ri-semina e pubblica. Il file impacchettato non
si committa: è ~2,5 MB di editor, e si rigenera da questi sorgenti.
