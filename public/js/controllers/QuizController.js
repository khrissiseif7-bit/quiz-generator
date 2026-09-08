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

    // Intentions de jeu.
    this.bus.subscribe("ui:answer", ({ choiceIndex }) => this.quizModel.answer(choiceIndex));
    this.bus.subscribe("ui:next", () => this.quizModel.next());

    // Fin du quiz -> écran résultat (le rendu est fait par ResultView).
    this.bus.subscribe("quiz:finished", () => {
      this.bus.publish("screen:show", { name: "result" });
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
}
