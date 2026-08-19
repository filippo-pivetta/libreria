/**
 * Montaigne quotes for the login screen (design doc §1, fix of Aug 19,
 * 2026): "whoever comes in every day reads a line carved above the
 * door". Ten well-known maxims from the Essais, public domain; one is
 * shown at random on each load — see LoginPage. Left in Italian: this is
 * user-facing literary content, the interface's current language, not
 * code — translating the quotes themselves is a product decision, not
 * this file's job.
 */
export const QUOTES = [
  "So che cosa fuggo, ma non so che cosa cerco.",
  "Il valore più grande è vivere a proposito.",
  "Non insegniamo a vivere, insegniamo a discorrere.",
  "La cosa del mondo più certa è la sua incertezza.",
  "Il mio mestiere e la mia arte è vivere.",
  "Non c'è desiderio più naturale del desiderio di conoscenza.",
  "La saggezza ha i suoi eccessi, e non ha meno bisogno di misura della follia.",
  "Il viaggio mi sembra un esercizio utile: l'anima vi si tiene in continuo movimento.",
  "Ogni uomo porta in sé la forma intera dell'umana condizione.",
  "Non è mai finito e non è mai stato cominciato, il nostro apprendistato del vivere.",
] as const;
