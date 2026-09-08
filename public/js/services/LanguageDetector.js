/**
 * LanguageDetector.js — Détection de la langue du texte source (fr / ar / en).
 *
 * COUCHE : Service (appelé uniquement par un Controller).
 * RÔLE : quand l'utilisateur choisit la langue « auto », deviner la langue pour
 * régler l'interface (dont la bascule dir=rtl pour l'arabe) sans attendre la
 * réponse du serveur. Heuristique légère, sans dépendance.
 * NB : la langue FINALE du quiz reste celle renvoyée par le serveur.
 */

const MOTS_FR = ["le", "la", "les", "de", "des", "un", "une", "et", "est", "en",
  "que", "pour", "dans", "qui", "ne", "pas", "sur", "au", "du", "ce"];
const MOTS_EN = ["the", "of", "and", "to", "in", "a", "is", "that", "it", "for",
  "on", "as", "with", "are", "be", "this", "by", "an", "or", "from"];

export class LanguageDetector {
  /**
   * Détecte la langue dominante d'un texte.
   * @param {string} text
   * @returns {"fr"|"ar"|"en"} Code langue (défaut "fr").
   */
  detect(text) {
    if (!text) return "fr";

    // 1) Arabe : plus de 15 % de lettres arabes -> "ar".
    const lettres = text.replace(/[^\p{L}]/gu, "");
    const arabes = text.match(/[؀-ۿ]/g) || [];
    if (lettres.length > 0 && arabes.length / lettres.length > 0.15) return "ar";

    // 2) Français vs anglais : comptage de mots vides.
    const mots = text.toLowerCase().match(/[a-zàâäéèêëïîôöùûüç]+/g) || [];
    let fr = 0, en = 0;
    for (const mot of mots) {
      if (MOTS_FR.includes(mot)) fr++;
      if (MOTS_EN.includes(mot)) en++;
    }
    return en > fr ? "en" : "fr";
  }
}
