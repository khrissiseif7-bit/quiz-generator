/**
 * FlashcardView.js — Vue des cartes de révision (recto/verso).
 *
 * COUCHE : View. Aucune logique métier : l'ordre du paquet et la logique
 * « à revoir repasse à la fin » sont gérés par QuizModel. Cette vue affiche la
 * carte, gère le retournement VISUEL (recto/verso) et émet les intentions
 * « je savais » / « à revoir ».
 */
export class FlashcardView {
  /**
   * @param {import("../services/EventBus.js").EventBus} bus
   * @param {import("../services/I18n.js").I18n} i18n
   */
  constructor(bus, i18n) {
    this.bus = bus;
    this.i18n = i18n;

    this.section = document.getElementById("screen-flashcards");
    this.progress = document.getElementById("flashcard-progress");
    this.card = document.getElementById("flashcard-card");
    this.front = document.getElementById("flashcard-front");
    this.back = document.getElementById("flashcard-back");
    this.actions = document.querySelector(".flashcard-actions");
    this.btnReview = document.getElementById("btn-review");
    this.btnKnown = document.getElementById("btn-known");
    this.done = document.getElementById("flashcards-done");
    this.btnBack = document.getElementById("btn-flashcards-back");

    // Retournement visuel (clic ou clavier).
    this.card.addEventListener("click", () => this._flip());
    this.card.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); this._flip(); }
    });

    this.btnKnown.addEventListener("click", () => this.bus.publish("ui:flashcard-mark", { known: true }));
    this.btnReview.addEventListener("click", () => this.bus.publish("ui:flashcard-mark", { known: false }));
    this.btnBack.addEventListener("click", () => this.bus.publish("ui:back-result", {}));

    this.bus.subscribe("screen:show", ({ name }) => {
      this.section.hidden = name !== "flashcards";
    });
    this.bus.subscribe("flashcard:card", (e) => this._renderCard(e));
    this.bus.subscribe("flashcard:done", () => this._renderDone());
  }

  _flip() {
    this.card.dataset.face = this.card.dataset.face === "back" ? "front" : "back";
  }

  /**
   * @param {{front:string, back:string, remaining:number, total:number}} e
   */
  _renderCard({ front, back, remaining, total }) {
    this.front.textContent = front;
    this.back.textContent = back;
    this.card.dataset.face = "front"; // toujours repartir du recto
    this.progress.textContent = this.i18n.t("flashcard_progress", {
      i: this.i18n.isoLTR(total - remaining + 1),
      n: this.i18n.isoLTR(remaining),
    });
    this.card.hidden = false;
    this.actions.hidden = false;
    this.done.hidden = true;
  }

  _renderDone() {
    this.card.hidden = true;
    this.actions.hidden = true;
    this.done.hidden = false;
  }
}
