/**
 * LanguageDetector.js — Détection de la langue du texte source (fr / ar / en).
 *
 * COUCHE : Service (appelé uniquement par un Controller).
 * RÔLE : deviner la langue du cours pour préremplir SettingsModel et piloter
 * l'I18n (dont la bascule dir=rtl pour l'arabe). Heuristique légère, pas de
 * dépendance externe attendue.
 */
export class LanguageDetector {
  /**
   * Détecte la langue dominante d'un texte.
   * @param {string} text - Texte source à analyser.
   * @returns {"fr"|"ar"|"en"} Code langue détecté (valeur par défaut à définir).
   */
  detect(text) {
    // TODO: repérer l'alphabet arabe (plage Unicode) -> "ar".
    // TODO: sinon, distinguer fr/en (mots outils fréquents, diacritiques) -> "fr" | "en".
    // TODO: retourner un code parmi {fr, ar, en}.
  }
}
