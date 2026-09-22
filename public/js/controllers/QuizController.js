/**
 * QuizController.js — Orchestration du déroulé du quiz, du résultat et des flashcards.
 *
 * COUCHE : Controller. Coordonne en délégant la logique au QuizModel (le Model
 * calcule, le Controller pilote navigation et transitions d'écran). Ne touche
 * pas au DOM.
 */
export class QuizController {
  /**
   * @param {object} deps
   * @param {import("../services/EventBus.js").EventBus} deps.bus
   * @param {import("../models/QuizModel.js").QuizModel} deps.quizModel
   */
  constructor(deps) {
    this.bus = deps.bus;
    this.quizModel = deps.quizModel;
    this.quizApiClient = deps.quizApiClient;
    this.settingsModel = deps.settingsModel;

    // Intentions de jeu.
    this.bus.subscribe("ui:answer", ({ choiceIndex }) => this.quizModel.answer(choiceIndex));
    this.bus.subscribe("ui:next", () => this.quizModel.next());

    // Fin du quiz -> écran résultat (le rendu est fait par ResultView).
    this.bus.subscribe("quiz:finished", (e) => {
      this.bus.publish("screen:show", { name: "result" });
      // Quiz ENREGISTRÉ + partie COMPLÈTE -> on enregistre la tentative (silencieux).
      if (this.quizModel.saved && this.quizModel.code && !this.quizModel.isReplay) {
        this._recordAttempt(e.score, e.total);
      }
    });

    // Actions de l'écran résultat.
    this.bus.subscribe("ui:replay-errors", () => {
      if (this.quizModel.replayErrors()) {
        this.bus.publish("screen:show", { name: "quiz" });
      }
    });
    this.bus.subscribe("ui:show-flashcards", () => {
      this.bus.publish("screen:show", { name: "flashcards" });
      this.quizModel.startFlashcards();
    });
    this.bus.subscribe("ui:new-quiz", () => {
      this.bus.publish("screen:show", { name: "upload" });
    });

    // Actions de l'écran flashcards.
    this.bus.subscribe("ui:flashcard-mark", ({ known }) => this.quizModel.markFlashcard(known));
    this.bus.subscribe("ui:back-result", () => {
      this.bus.publish("screen:show", { name: "result" });
    });
  }

  /**
   * Enregistre la tentative (POST /attempts) et publie les stats à afficher.
   * SILENCIEUX : un échec réseau ne doit pas gâcher l'affichage du résultat.
   * @param {number} score @param {number} total
   * @returns {Promise<void>}
   */
  async _recordAttempt(score, total) {
    try {
      const res = await this.quizApiClient.addAttempt(
        this.quizModel.code, score, total, this.settingsModel.getAccessCode()
      );
      this.bus.publish("result:stats", { stats: res.stats });
    } catch {
      /* enregistrement silencieux : aucune erreur affichée sur le résultat */
    }
  }
}
