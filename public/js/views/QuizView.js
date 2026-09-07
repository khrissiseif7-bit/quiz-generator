/**
 * QuizView.js — Vue de l'écran de quiz (écran 2).
 *
 * COUCHE : View.
 * RÈGLE : aucune logique métier. Ne calcule PAS si une réponse est correcte
 * (c'est QuizModel). Elle affiche la question courante et émet l'intention
 * « réponse choisie » / « naviguer » sur le bus.
 */
export class QuizView {
  /**
   * @param {import("../services/EventBus.js").EventBus} bus - Bus d'événements partagé.
   * @param {import("../services/I18n.js").I18n} i18n - Service de traduction.
   */
  constructor(bus, i18n) {
    // TODO: mémoriser bus et i18n, récupérer refs DOM (#screen-quiz, #quiz-question,
    //       #quiz-choices, #quiz-index, #quiz-total, #btn-prev/next/finish).
    // TODO: brancher les clics -> publier "ui:answer-selected", "ui:nav" (prev/next),
    //       "ui:finish-requested".
    // TODO: s'abonner à "quiz:loaded", "quiz:navigated", "quiz:answered" pour se redessiner.
  }

  /** Affiche cet écran. @returns {void} */
  show() {
    // TODO: rendre #screen-quiz visible, masquer les autres.
  }

  /** Masque cet écran. @returns {void} */
  hide() {
    // TODO: poser [hidden] sur #screen-quiz.
  }

  /**
   * Rend une question et l'état de progression. Purement présentation.
   * @param {object} question - Question au format contrat (question, choices[4], ...).
   * @param {number} index - Index de la question courante (0-based).
   * @param {number} total - Nombre total de questions.
   * @param {number|undefined} selectedIndex - Choix déjà sélectionné, s'il existe.
   * @returns {void}
   */
  render(question, index, total, selectedIndex) {
    // TODO: injecter l'énoncé et les 4 choix dans le DOM, marquer la sélection,
    //       mettre à jour #quiz-index / #quiz-total. Aucune évaluation ici.
  }
}
