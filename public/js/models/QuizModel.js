/**
 * QuizModel.js — État du quiz en cours.
 *
 * COUCHE : Model.
 * RÈGLE : ne touche JAMAIS au DOM. Toute mutation notifie les Views via l'EventBus.
 *
 * RESPONSABILITÉ : détenir les questions (au format du contrat, voir
 * /docs/contract.md), l'index de la question courante, les réponses de
 * l'utilisateur et le calcul du score. Le SCORE est une donnée métier : il
 * est calculé ICI, jamais dans une View.
 */
export class QuizModel {
  /**
   * @param {import("../services/EventBus.js").EventBus} bus - Bus d'événements partagé.
   */
  constructor(bus) {
    // TODO: mémoriser le bus.
    // TODO: initialiser : questions (Array), flashcards (Array),
    //       currentIndex (number = 0), answers (Map<questionId, choiceIndex>).
  }

  /**
   * Charge un quiz validé (structure conforme au contrat) et réinitialise l'état.
   * @param {{title:string, language:string, questions:Array, flashcards:Array}} quiz
   * @returns {void}
   */
  load(quiz) {
    // TODO: stocker questions/flashcards, remettre currentIndex à 0, vider answers,
    //       publier "quiz:loaded".
  }

  /**
   * @returns {object|null} La question à l'index courant, ou null si hors bornes.
   */
  getCurrentQuestion() {
    // TODO: retourner questions[currentIndex].
  }

  /**
   * Enregistre la réponse choisie pour une question et publie le changement.
   * @param {string} questionId - Identifiant de la question.
   * @param {number} choiceIndex - Index (0..3) du choix sélectionné.
   * @returns {void}
   */
  answer(questionId, choiceIndex) {
    // TODO: enregistrer la réponse dans answers, publier "quiz:answered".
  }

  /**
   * Avance/recule dans les questions dans les bornes valides.
   * @param {number} delta - +1 (suivant) ou -1 (précédent).
   * @returns {void}
   */
  move(delta) {
    // TODO: modifier currentIndex en le bornant, publier "quiz:navigated".
  }

  /**
   * Calcule le score (nombre de bonnes réponses) — LOGIQUE MÉTIER.
   * @returns {{score:number, total:number}} Score obtenu et total de questions.
   */
  computeScore() {
    // TODO: comparer answers à correct_index de chaque question, retourner {score,total}.
  }
}
