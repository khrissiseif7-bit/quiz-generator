/**
 * QuizController.js — Orchestration du déroulé du quiz et du résultat.
 *
 * COUCHE : Controller.
 * RÈGLES :
 *   - Seul le Controller pilote la logique de navigation/scoring en déléguant
 *     au QuizModel (le Model calcule, le Controller coordonne).
 *   - Écoute les intentions UI via le bus ; ne touche pas au DOM.
 */
export class QuizController {
  /**
   * @param {object} deps - Dépendances injectées par app.js.
   * @param {import("../services/EventBus.js").EventBus} deps.bus
   * @param {import("../models/QuizModel.js").QuizModel} deps.quizModel
   */
  constructor(deps) {
    // TODO: mémoriser les dépendances.
    // TODO: s'abonner aux intentions UI : "ui:answer-selected", "ui:nav",
    //       "ui:finish-requested", "ui:restart-requested".
  }

  /**
   * Enregistre la réponse choisie dans le Model.
   * @param {string} questionId - Identifiant de la question.
   * @param {number} choiceIndex - Index (0..3) sélectionné.
   * @returns {void}
   */
  handleAnswer(questionId, choiceIndex) {
    // TODO: appeler quizModel.answer(questionId, choiceIndex).
  }

  /**
   * Navigue entre les questions.
   * @param {number} delta - +1 (suivant) ou -1 (précédent).
   * @returns {void}
   */
  handleNavigate(delta) {
    // TODO: appeler quizModel.move(delta).
  }

  /**
   * Termine le quiz : déclenche le calcul du score et la transition vers l'écran résultat.
   * @returns {void}
   */
  handleFinish() {
    // TODO: quizModel.computeScore(), puis publier "quiz:finished" avec le résultat.
  }
}
