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

from app.core.testo import TRATTINI_LUNGHI

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
