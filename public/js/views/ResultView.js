/**
 * ResultView.js — Vue de l'écran de résultat.
 *
 * COUCHE : View. Aucune logique métier : le score et la liste des ratées sont
 * CALCULÉS par QuizModel ; cette vue les affiche et émet les intentions des
 * boutons (rejouer les erreurs / flashcards / nouveau quiz).
 */
export class ResultView {
  /**
   * @param {import("../services/EventBus.js").EventBus} bus
   * @param {import("../services/I18n.js").I18n} i18n
   */
  constructor(bus, i18n) {
    this.bus = bus;
    this.i18n = i18n;

    this.section = document.getElementById("screen-result");
    this.score = document.getElementById("result-score");
    this.percent = document.getElementById("result-percent");
    this.missedTitle = document.getElementById("result-missed-title");
    this.missed = document.getElementById("result-missed");
    this.btnReplay = document.getElementById("btn-replay-errors");
    this.btnFlashcards = document.getElementById("btn-flashcards");
    this.btnNewQuiz = document.getElementById("btn-new-quiz");

    this.btnReplay.addEventListener("click", () => this.bus.publish("ui:replay-errors", {}));
    this.btnFlashcards.addEventListener("click", () => this.bus.publish("ui:show-flashcards", {}));
    this.btnNewQuiz.addEventListener("click", () => this.bus.publish("ui:new-quiz", {}));

    this.bus.subscribe("screen:show", ({ name }) => {
      this.section.hidden = name !== "result";
    });
    this.bus.subscribe("quiz:finished", (e) => this._render(e));
  }

  /**
   * @param {{score:number, total:number, percent:number, missed:Array}} e
   */
  _render({ score, total, percent, missed }) {
    this.score.textContent = `${score} / ${total}`;
    this.percent.textContent = this.i18n.t("result_percent", { p: percent });

    // Liste des questions ratées.
    this.missed.innerHTML = "";
    const yaDesErreurs = missed.length > 0;
    this.missedTitle.hidden = !yaDesErreurs;
    for (const item of missed) {
      const li = document.createElement("li");
      const q = document.createElement("div");
      q.textContent = item.question;
      const bonne = document.createElement("div");
      bonne.className = "correct-answer";
      bonne.textContent = `${this.i18n.t("result_correct_label")} ${item.correctText}`;
      li.appendChild(q);
      li.appendChild(bonne);
      this.missed.appendChild(li);
    }

    // « Rejouer les erreurs » n'a de sens que s'il y a des erreurs.
    this.btnReplay.disabled = !yaDesErreurs;
  }
}
