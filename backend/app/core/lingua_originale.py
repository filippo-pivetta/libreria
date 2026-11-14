"""La lingua originale di un'opera come codice, sempre.

`libro.lingua_originale` è un codice di lingua (ISO 639-1, o 639-3 dove il
639-1 non esiste: `grc` per il greco antico). Il frontend lo passa a
`Intl.DisplayNames` (`frontend/src/lib/formato.ts`, `formattaLingua`), che
lo scrive per esteso nella lingua dell'interfaccia: un nome già per esteso
arriva a schermo così com'è.

Il 14 novembre 2026 il catalogo di produzione aveva circa trecento righe
non conformi: «inglese» 134, «English» 95, «italiano», «Italian»,
«Amerikanisches Englisch», e perfino la stringa `"null"`. Le scriveva il
lavoro di arricchimento assistito, che chiedeva al modello «la lingua
originale» senza vincolarne la forma; Wikidata invece passava già da una
tabella di codici. La migrazione `20261114120000` ha ripulito le righe e
aggiunto un CHECK; questo modulo è la difesa a monte, così che una risposta
fuori forma diventi un dato assente invece di un lavoro fallito.
"""

CODICI: frozenset[str] = frozenset(
    {
        "ar", "ca", "cs", "da", "de", "el", "en", "es", "fa", "fi", "fr", "grc",
        "he", "hi", "hu", "it", "ja", "ko", "la", "nl", "no", "pl", "pt", "ro",
        "ru", "sr", "sv", "tl", "tr", "uk", "yi", "zh",
    }
)  # fmt: skip
"""I codici ammessi. Un elenco chiuso e non «qualunque stringa di due
lettere»: è anche l'`enum` che vincola la risposta del modello, e un codice
fuori elenco è più probabilmente un errore che una lingua rara."""

_NOMI: dict[str, str] = {
    # italiano
    "arabo": "ar", "catalano": "ca", "ceco": "cs", "danese": "da", "tedesco": "de",
    "greco": "el", "greco moderno": "el", "inglese": "en", "spagnolo": "es",
    "persiano": "fa", "finlandese": "fi", "francese": "fr", "greco antico": "grc",
    "ebraico": "he", "ungherese": "hu", "italiano": "it", "giapponese": "ja",
    "coreano": "ko", "latino": "la", "olandese": "nl", "norvegese": "no",
    "polacco": "pl", "portoghese": "pt", "rumeno": "ro", "russo": "ru",
    "serbo": "sr", "svedese": "sv", "turco": "tr", "ucraino": "uk",
    "yiddish": "yi", "cinese": "zh",
    # inglese
    "arabic": "ar", "catalan": "ca", "czech": "cs", "danish": "da", "german": "de",
    "greek": "el", "english": "en", "american english": "en", "british english": "en",
    "spanish": "es", "persian": "fa", "finnish": "fi", "french": "fr",
    "ancient greek": "grc", "hebrew": "he", "hindi": "hi", "hungarian": "hu",
    "italian": "it", "japanese": "ja", "korean": "ko", "latin": "la", "dutch": "nl",
    "norwegian": "no", "polish": "pl", "portuguese": "pt", "romanian": "ro",
    "russian": "ru", "serbian": "sr", "swedish": "sv", "tagalog": "tl",
    "turkish": "tr", "ukrainian": "uk", "chinese": "zh",
    # tedesco, misurato in produzione
    "amerikanisches englisch": "en", "englisch": "en", "deutsch": "de",
    # ISO 639-2 a tre lettere
    "eng": "en", "ita": "it", "fre": "fr", "fra": "fr", "ger": "de", "deu": "de",
    "spa": "es", "rus": "ru", "jpn": "ja", "lat": "la",
}  # fmt: skip


def normalizza(valore: object) -> str | None:
    """Il codice di `valore`, o None se non lo si riconosce.

    None e non il valore originale: il PRD preferisce un dato assente a un
    dato inventato, e una stringa non riconosciuta non è un dato.
    """
    if not isinstance(valore, str):
        return None
    chiave = valore.strip().lower()
    if not chiave or chiave in {"null", "none", "unknown", "sconosciuta"}:
        return None
    if chiave in CODICI:
        return chiave
    # "en-US", "pt_BR": conta la lingua, non la variante regionale.
    base = chiave.replace("_", "-").split("-")[0]
    if base in CODICI:
        return base
    return _NOMI.get(chiave)
