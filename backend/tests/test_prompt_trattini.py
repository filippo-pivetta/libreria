"""Nessun messaggio inviato al modello contiene un trattino lungo.

Non è pedanteria tipografica sul codice: è la coerenza fra ciò che si
chiede e ciò che si mostra. Il prompt dei suggerimenti di lettura vietava
il trattino lungo e ne usava due tre righe più sopra, dentro le stesse
istruzioni — cioè mostrava al modello un esempio dello stile che gli
stava vietando.

Il controllo guarda la sorgente e non l'output perché è lì che il difetto
nasce: un prompt nuovo scritto fra sei mesi con un inciso fra lineette
non fallirebbe nessun test di comportamento, e la regola si sgretolerebbe
in silenzio.

I docstring e i commenti restano liberi: la lineetta è di casa nella
documentazione di questo repo, e questo file ne è pieno.
"""

import ast
import pathlib
import re

from app.core.testo import (
    REGOLA_STILE_PER_IL_MODELLO,
    TRATTINI_LUNGHI,
    VOCE_CATALOGO,
    VOCE_PERSONALE,
    ha_trattini_lunghi,
)

MODULI = ("app/cataloghi/llm.py", "app/cataloghi/llm_personale.py")

_RADICE = pathlib.Path(__file__).resolve().parents[1]


def _messaggi(sorgente: str) -> list[tuple[int, str]]:
    """Le stringhe che finiscono in un `{"role": ..., "content": ...}`.

    Via AST e non per regex: il contenuto è quasi sempre una decina di
    letterali concatenati implicitamente su righe diverse, e
    `literal_eval` li ricompone come li vedrà il modello — che è l'unica
    forma su cui abbia senso cercare.
    """
    fuori: list[tuple[int, str]] = []
    for nodo in ast.walk(ast.parse(sorgente)):
        if not isinstance(nodo, ast.Dict):
            continue
        chiavi = [k.value for k in nodo.keys if isinstance(k, ast.Constant)]
        if "content" not in chiavi:
            continue
        valore = nodo.values[chiavi.index("content")]
        try:
            testo = ast.literal_eval(valore)
        except (ValueError, SyntaxError):
            continue  # f-string con parti calcolate: non è un letterale
        if isinstance(testo, str):
            fuori.append((nodo.lineno, testo))
    return fuori


def test_nessun_prompt_contiene_un_trattino_lungo() -> None:
    colpevoli = []
    for modulo in MODULI:
        sorgente = (_RADICE / modulo).read_text()
        for riga, testo in _messaggi(sorgente):
            for trovato in re.finditer(f".{{0,30}}[{TRATTINI_LUNGHI}].{{0,30}}", testo):
                colpevoli.append(f"{modulo}:{riga} …{trovato.group(0)}…")
    assert not colpevoli, "Trattino lungo dentro un messaggio al modello:\n" + "\n".join(colpevoli)


def test_i_moduli_di_prompt_usano_la_costante_condivisa() -> None:
    """La regola sta in `app/core/testo.py` e si importa da lì.

    Riscritta a mano in ogni prompt, divergerebbe alla prima correzione —
    ed è già successo: era in uno solo dei sei prompt.
    """
    for modulo in MODULI:
        sorgente = (_RADICE / modulo).read_text()
        assert "REGOLA_TRATTINI_PER_IL_MODELLO" in sorgente, modulo


# ---------------------------------------------------------------------------
# La regola di stile (`REGOLA_STILE_PER_IL_MODELLO`), stessa disciplina.
#
# Vincola il registro dei cinque prompt che producono prosa da leggere,
# e va tenuta insieme dagli stessi due controlli che tengono il trattino:
# che non contraddica se stessa, e che non manchi proprio dove serve.

PROSA = {
    "app/cataloghi/llm.py": {"espandi_descrizione", "accorcia_descrizione"},
    "app/cataloghi/llm_personale.py": {"genera_preview", "genera_temi", "genera_suggerimenti"},
}
"""I prompt che scrivono prosa che un Utente legge.

Fuori restano `traduci_descrizione`, che deve restare fedele anche a un
originale scritto male, e le classificazioni (`classifica_e_deduci`,
`confronta_autori`, `valuta_duplicati`), che non producono prosa."""


def _funzioni(sorgente: str) -> dict[str, str]:
    albero = ast.parse(sorgente)
    righe = sorgente.splitlines()
    fuori = {}
    for nodo in albero.body:
        if isinstance(nodo, (ast.AsyncFunctionDef, ast.FunctionDef)):
            fuori[nodo.name] = "\n".join(righe[nodo.lineno - 1 : nodo.end_lineno])
    return fuori


def test_la_regola_di_stile_non_usa_i_segni_che_i_prompt_vietano() -> None:
    """Stesso difetto del trattino lungo scritto dentro la regola che lo
    vietava: il prompt del parere vieta ogni virgoletta nell'output, e una
    regola che ne contenesse gliene mostrerebbe un esempio."""
    assert not ha_trattini_lunghi(REGOLA_STILE_PER_IL_MODELLO)
    virgolette = [c for c in '"“”«»' if c in REGOLA_STILE_PER_IL_MODELLO]
    assert not virgolette, f"virgolette nella regola di stile: {virgolette}"


def test_i_prompt_di_prosa_portano_la_regola_di_stile() -> None:
    mancanti = []
    for modulo, attese in PROSA.items():
        funzioni = _funzioni((_RADICE / modulo).read_text())
        for nome in attese:
            assert nome in funzioni, f"{modulo}: {nome} non esiste piu'"
            if "REGOLA_STILE_PER_IL_MODELLO" not in funzioni[nome]:
                mancanti.append(f"{modulo}:{nome}")
    assert not mancanti, "prompt di prosa senza la regola di stile:\n" + "\n".join(mancanti)


def test_la_traduzione_resta_fuori_dalla_regola_di_stile() -> None:
    """Non e' una dimenticanza: una traduzione riporta il testo sorgente,
    anche quando il sorgente e' scritto in formule da quarta di copertina.
    Chiedere li' un registro diverso significherebbe chiedere di riscrivere."""
    funzioni = _funzioni((_RADICE / "app/cataloghi/llm.py").read_text())
    assert "REGOLA_STILE_PER_IL_MODELLO" not in funzioni["traduci_descrizione"]


# ---------------------------------------------------------------------------
# Le due voci. Non una sola: una descrizione e' dato condiviso e non si
# rivolge a nessuno, un parere parla a chi l'ha chiesto. Il confine coincide
# con quello fra i due moduli, che esiste per la regola 19 del PRD.

VOCI = {
    "app/cataloghi/llm.py": (VOCE_CATALOGO, {"espandi_descrizione", "accorcia_descrizione"}),
    "app/cataloghi/llm_personale.py": (
        VOCE_PERSONALE,
        {"genera_preview", "genera_temi", "genera_suggerimenti"},
    ),
}


def test_ogni_prompt_di_prosa_stabilisce_la_propria_voce() -> None:
    """`genera_suggerimenti` non la stabiliva affatto, e gli altri due la
    scrivevano a mano in due forme gia' divergenti."""
    nome_costante = {id(VOCE_CATALOGO): "VOCE_CATALOGO", id(VOCE_PERSONALE): "VOCE_PERSONALE"}
    mancanti = []
    for modulo, (voce, attese) in VOCI.items():
        funzioni = _funzioni((_RADICE / modulo).read_text())
        for nome in attese:
            if nome_costante[id(voce)] not in funzioni[nome]:
                mancanti.append(f"{modulo}:{nome}")
    assert not mancanti, "prompt di prosa senza voce:\n" + "\n".join(mancanti)


def test_le_due_voci_restano_distinte() -> None:
    """Il giorno in cui qualcuno le unifica, questo test lo dice: una
    descrizione che desse del tu direbbe a ogni lettore una cosa che vale
    per un altro, perche' quella riga la leggono tutti."""
    for modulo, (_, attese) in VOCI.items():
        altra = VOCE_PERSONALE if modulo.endswith("llm.py") else VOCE_CATALOGO
        nome = "VOCE_PERSONALE" if modulo.endswith("llm.py") else "VOCE_CATALOGO"
        funzioni = _funzioni((_RADICE / modulo).read_text())
        for f in attese:
            assert nome not in funzioni[f], f"{modulo}:{f} usa la voce dell'altra famiglia"
        assert altra is not None


def test_le_voci_non_usano_i_segni_che_i_prompt_vietano() -> None:
    for voce in (VOCE_PERSONALE, VOCE_CATALOGO):
        assert not ha_trattini_lunghi(voce)
        assert not [c for c in '"“”«»' if c in voce]
