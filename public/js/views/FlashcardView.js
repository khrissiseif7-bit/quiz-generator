/**
 * FlashcardView.js — Vue des cartes de révision (recto/verso).
 *
 * COUCHE : View.
 * RÈGLE : aucune logique métier. Affiche une flashcard (front/back) et gère
 * seulement l'interaction de retournement visuel. Les données proviennent du
 * QuizModel (via bus) ; cette vue ne les transforme pas.
 */
export class FlashcardView {
  /**
   * @param {import("../services/EventBus.js").EventBus} bus - Bus d'événements partagé.
   * @param {import("../services/I18n.js").I18n} i18n - Service de traduction.
   */
  constructor(bus, i18n) {
    // TODO: mémoriser bus et i18n, récupérer la ref DOM (#flashcard).
    // TODO: brancher le clic -> retournement visuel (front/back).
    // TODO: s'abonner à "quiz:loaded" / "quiz:navigated" pour afficher la carte associée.
  }

  /** Affiche la zone flashcard. @returns {void} */
  show() {
    // TODO: retirer [hidden] de #flashcard.
  }

  /** Masque la zone flashcard. @returns {void} */
  hide() {
    // TODO: poser [hidden] sur #flashcard.
  }

  /**
   * Rend une flashcard. Purement présentation.
   * @param {{id:string, front:string, back:string, source_page:number}} card - Carte à afficher.
   * @returns {void}
   */
  render(card) {
    // TODO: injecter front/back dans le DOM, réinitialiser l'état retourné.
  }
}
