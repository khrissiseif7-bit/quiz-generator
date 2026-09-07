/**
 * DocumentModel.js — État du document source (le cours).
 *
 * COUCHE : Model.
 * RÈGLE : un Model ne touche JAMAIS au DOM. Il notifie ses changements
 * uniquement via l'EventBus (Model -> View passe par le bus).
 *
 * RESPONSABILITÉ : mémoriser le texte source, les pages extraites d'un PDF
 * et la langue détectée. Aucune extraction ni détection ici : ces calculs
 * appartiennent aux Services (PdfExtractor, LanguageDetector), appelés par
 * les Controllers, qui déposent ensuite le résultat dans ce Model.
 */
export class DocumentModel {
  /**
   * @param {import("../services/EventBus.js").EventBus} bus - Bus d'événements partagé.
   */
  constructor(bus) {
    // TODO: mémoriser le bus.
    // TODO: initialiser l'état : text (string), pages (Array<{page:number,text:string}>),
    //       language (null | "fr" | "ar" | "en").
  }

  /**
   * Définit le texte source et les pages, puis publie le changement.
   * @param {string} text - Texte brut complet du cours.
   * @param {Array<{page:number, text:string}>} [pages] - Pages (si issu d'un PDF).
   * @returns {void}
   */
  setSource(text, pages) {
    // TODO: stocker text et pages, publier "document:changed" sur le bus.
  }

  /**
   * Enregistre la langue détectée et publie le changement.
   * @param {"fr"|"ar"|"en"} language - Code langue détecté.
   * @returns {void}
   */
  setLanguage(language) {
    // TODO: stocker language, publier "document:language" sur le bus.
  }

  /**
   * @returns {string} Le texte source courant (vide si aucun).
   */
  getText() {
    // TODO: retourner le texte source.
  }

  /**
   * @returns {Array<{page:number, text:string}>} Les pages extraites (vide si aucune).
   */
  getPages() {
    // TODO: retourner les pages.
  }
}
