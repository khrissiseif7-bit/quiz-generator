/**
 * QuizView.js — Vue de l'écran de quiz (une question à la fois).
 *
 * COUCHE : View. Aucune logique métier : elle NE calcule PAS si une réponse est
 * correcte (c'est QuizModel). Elle affiche la question et ses propositions
 * (déjà mélangées par le Model), émet l'intention « réponse choisie » / « suivant »,
 * puis colore les propositions et révèle explication + extrait source à partir
 * des données publiées par le Model.
 */
export class QuizView {
  /**
   * @param {import("../services/EventBus.js").EventBus} bus
   * @param {import("../services/I18n.js").I18n} i18n
   */
  constructor(bus, i18n) {
    this.bus = bus;
    this.i18n = i18n;

    this.section = document.getElementById("screen-quiz");
    this.progress = document.getElementById("quiz-progress");
    this.questionEl = document.getElementById("quiz-heading");
    this.choicesEl = document.getElementById("quiz-choices");
    this.feedback = document.getElementById("quiz-feedback");
    this.verdict = document.getElementById("quiz-verdict");
    this.explanation = document.getElementById("quiz-explanation");
    this.sourceText = document.getElementById("quiz-source-text");
    this.btnNext = document.getElementById("btn-next");

    this.choiceButtons = [];
    this.current = null;   // question courante (pour explication/source)
    this.isLast = false;

    this.btnNext.addEventListener("click", () => this.bus.publish("ui:next", {}));

    this.bus.subscribe("screen:show", ({ name }) => {
      this.section.hidden = name !== "quiz";
    });
    this.bus.subscribe("quiz:question", (e) => this._renderQuestion(e));
    this.bus.subscribe("quiz:answered", (e) => this._renderAnswer(e));
  }

  /**
   * Affiche une question et remet l'écran à l'état « en attente de réponse ».
   * @param {{question:object, index:number, total:number}} e
   */
  _renderQuestion({ question, index, total }) {
    this.current = question;
    this.isLast = index === total - 1;

    this.progress.textContent = this.i18n.t("quiz_progress", { i: index + 1, n: total });
    this.questionEl.textContent = question.question;

    // (Re)construction des propositions.
    this.choicesEl.innerHTML = "";
    this.choiceButtons = question.choices.map((texte, i) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice";
      btn.textContent = texte;
      btn.addEventListener("click", () => this.bus.publish("ui:answer", { choiceIndex: i }));
      li.appendChild(btn);
      this.choicesEl.appendChild(li);
      return btn;
    });

    // Masque le feedback et le bouton Suivant tant qu'aucune réponse n'est donnée.
    this.feedback.hidden = true;
    this.btnNext.hidden = true;
  }

  /**
   * Verrouille les propositions, colore bonne/mauvaise et révèle le feedback.
   * @param {{choiceIndex:number, correctIndex:number, correct:boolean}} e
   */
  _renderAnswer({ choiceIndex, correctIndex, correct }) {
    this.choiceButtons.forEach((btn, i) => {
      btn.disabled = true;
      if (i === correctIndex) btn.classList.add("is-correct");
      if (i === choiceIndex && !correct) btn.classList.add("is-wrong");
    });

    this.verdict.textContent = this.i18n.t(correct ? "verdict_correct" : "verdict_wrong");
    this.verdict.className = "quiz-verdict " + (correct ? "correct" : "wrong");
    this.explanation.textContent = this.current.explanation;
    this.sourceText.textContent = this.current.source_excerpt;

    this.feedback.hidden = false;
    this.btnNext.hidden = false;
    this.btnNext.textContent = this.i18n.t(this.isLast ? "btn_finish" : "btn_next");
  }
}
