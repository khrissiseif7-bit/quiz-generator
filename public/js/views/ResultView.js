/**
 * ResultView.js — Vue de l'écran de résultat (écran 3).
 *
 * COUCHE : View.
 * RÈGLE : aucune logique métier. Le score est CALCULÉ par QuizModel ; cette
 * vue se contente de l'afficher, ainsi que le récapitulatif question/réponse.
 */
export class ResultView {
  /**
   * @param {import("../services/EventBus.js").EventBus} bus - Bus d'événements partagé.
   * @param {import("../services/I18n.js").I18n} i18n - Service de traduction.
   */
  constructor(bus, i18n) {
    // TODO: mémoriser bus et i18n, récupérer refs DOM (#screen-result,
    //       #result-score, #result-total, #result-review, #btn-restart).
    // TODO: brancher le clic « Recommencer » -> publier "ui:restart-requested".
    // TODO: s'abonner à "quiz:finished" pour se redessiner.
  }

  /** Affiche cet écran. @returns {void} */
  show() {
    // TODO: rendre #screen-result visible, masquer les autres.
  }

  /** Masque cet écran. @returns {void} */
  hide() {
    // TODO: poser [hidden] sur #screen-result.
  }

  /**
   * Rend le score final et le récapitulatif. Purement présentation.
   * @param {{score:number, total:number}} scoreData - Résultat fourni par QuizModel.
   * @param {Array<object>} review - Détail par question (énoncé, réponse donnée, correcte).
   * @returns {void}
   */
  render(scoreData, review) {
    // TODO: afficher score/total et construire la liste récapitulative dans #result-review.
  }
}
