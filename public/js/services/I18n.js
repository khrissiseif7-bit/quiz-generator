/**
 * I18n.js — Internationalisation (fr / ar / en) et bascule RTL.
 *
 * COUCHE : Service transverse (utilisé par les Views pour l'affichage).
 * RÔLE :
 *   - fournir les libellés traduits (attributs data-i18n du HTML),
 *   - basculer la direction du document (dir="rtl" sur <html> pour l'arabe).
 * Ne contient aucune logique métier : uniquement de la présentation/langue.
 */
export class I18n {
  constructor() {
    // TODO: initialiser le dictionnaire { fr:{...}, ar:{...}, en:{...} }
    //       et la langue courante par défaut.
  }

  /**
   * Change la langue active et met à jour la direction du document.
   * @param {"fr"|"ar"|"en"} language - Langue à activer.
   * @returns {void}
   */
  setLanguage(language) {
    // TODO: mémoriser la langue courante.
    // TODO: poser document.documentElement.dir = (language === "ar") ? "rtl" : "ltr".
    // TODO: poser document.documentElement.lang = language.
  }

  /**
   * Traduit une clé dans la langue courante.
   * @param {string} key - Clé de traduction (ex. "btn_generate").
   * @returns {string} Libellé traduit (ou la clé si absente).
   */
  t(key) {
    // TODO: retourner dictionnaire[langue][key] ?? key.
  }

  /**
   * Applique les traductions à tous les éléments [data-i18n] du DOM.
   * @param {ParentNode} [root] - Racine de recherche (par défaut document).
   * @returns {void}
   */
  applyTo(root) {
    // TODO: parcourir [data-i18n] et remplacer leur texte par t(clé).
  }
}
