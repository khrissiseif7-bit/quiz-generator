/**
 * UploadView.js — Vue de l'écran d'import (écran 1).
 *
 * COUCHE : View.
 * RÈGLE : une View ne contient AUCUNE logique métier (ni score, ni validation,
 * ni appel de Service). Elle se limite à :
 *   - lire/écrire le DOM de #screen-upload,
 *   - émettre des événements d'intention utilisateur sur l'EventBus,
 *   - réagir aux événements de Models pour se redessiner.
 * Elle ne connaît NI les Models NI les Services directement : tout passe par le bus.
 */
export class UploadView {
  /**
   * @param {import("../services/EventBus.js").EventBus} bus - Bus d'événements partagé.
   * @param {import("../services/I18n.js").I18n} i18n - Service de traduction (affichage seul).
   */
  constructor(bus, i18n) {
    // TODO: mémoriser bus et i18n, récupérer les références DOM (#screen-upload,
    //       #file-pdf, #textarea-source, #btn-generate, #upload-error).
    // TODO: brancher les écouteurs DOM qui PUBLIENT des intentions, ex :
    //       - "ui:file-selected" (fichier PDF choisi)
    //       - "ui:generate-requested" (clic sur « Générer »)
    // TODO: s'abonner aux événements du bus pertinents (ex "app:error").
  }

  /** Affiche cet écran. @returns {void} */
  show() {
    // TODO: retirer [hidden] de #screen-upload, le poser sur les autres écrans.
  }

  /** Masque cet écran. @returns {void} */
  hide() {
    // TODO: poser [hidden] sur #screen-upload.
  }

  /**
   * Affiche un message d'erreur (texte déjà traduit fourni par le Controller).
   * @param {string} message - Message à afficher.
   * @returns {void}
   */
  showError(message) {
    // TODO: écrire le message dans #upload-error et le rendre visible.
  }
}
