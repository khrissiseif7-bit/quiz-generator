/**
 * QuizView.js — Vue de l'écran de quiz (une question à la fois).
 *
 * COUCHE : View. Aucune logique métier : elle NE calcule PAS si une réponse est
 * correcte (c'est QuizModel). Elle affiche la question et ses propositions
 * (déjà mélangées par le Model), émet l'intention « réponse choisie » / « suivant »,
 * puis colore les propositions et révèle explication + extrait source à partir
 * des données publiées par le Model.
 */
import { citationIntro } from "../services/citation.js";

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
    this.sourceBlock = document.getElementById("quiz-source-block");
    this.sourceIntro = document.getElementById("quiz-source-intro");
    this.sourceText = document.getElementById("quiz-source-text");
    this.manualBadge = document.getElementById("quiz-manual-badge");
    this.btnNext = document.getElementById("btn-next");
    this.progressFill = document.getElementById("quiz-progress-fill");

    this.choiceButtons = [];
    this.current = null;   // question courante (pour explication/source)
    this.isLast = false;

    this.btnNext.addEventListener("click", () => this.bus.publish("ui:next", {}));

    // Raccourcis clavier : 1–4 pour répondre, Entrée pour continuer. La View ne
    // fait qu'émettre les MÊMES intentions que les clics (aucune logique métier).
    document.addEventListener("keydown", (e) => this._onKey(e));

    this.bus.subscribe("screen:show", ({ name }) => {
      this.section.hidden = name !== "quiz";
    });
    this.bus.subscribe("quiz:question", (e) => this._renderQuestion(e));
    this.bus.subscribe("quiz:answered", (e) => this._renderAnswer(e));
  }

  /**
   * Raccourcis clavier de l'écran quiz (actifs seulement quand il est visible).
   * @param {KeyboardEvent} e
   */
  _onKey(e) {
    if (this.section.hidden) return;
    const tag = ((e.target && e.target.tagName) || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (e.key >= "1" && e.key <= "4") {
      const i = Number(e.key) - 1;
      if (this.choiceButtons[i] && !this.choiceButtons[i].disabled) {
        this.bus.publish("ui:answer", { choiceIndex: i });
      }
    } else if (e.key === "Enter" && !this.btnNext.hidden) {
      e.preventDefault();
      this.bus.publish("ui:next", {});
    }
  }

  /**
   * Affiche une question et remet l'écran à l'état « en attente de réponse ».
   * @param {{question:object, index:number, total:number}} e
   */
  _renderQuestion({ question, index, total }) {
    this.current = question;
    this.isLast = index === total - 1;

    // Fraction isolée en LTR pour rester lisible en arabe (« 1 / 2 », pas « 2 / 1 »).
    const frac = this.i18n.isoLTR(`${index + 1} / ${total}`);
    this.progress.textContent = this.i18n.t("quiz_progress", { frac });
    // Barre de progression qui GLISSE (transition CSS sur la largeur).
    this.progressFill.style.width = `${((index + 1) / total) * 100}%`;
    this.questionEl.textContent = question.question;

    // (Re)construction des propositions, avec un badge de raccourci (1–4).
    this.choicesEl.innerHTML = "";
    this.choiceButtons = question.choices.map((texte, i) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice";
      const key = document.createElement("span");
      key.className = "choice-key";
      key.setAttribute("aria-hidden", "true");
      key.textContent = String(i + 1);
      const label = document.createElement("span");
      label.className = "choice-label";
      label.textContent = texte;
      btn.append(key, label);
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
    // Question IA (avec extrait) -> bloc citation « D'après le cours, page N ».
    // Question ajoutée à la main (pas d'extrait) -> badge distinct, jamais « page null ».
    if (this.current.source_excerpt) {
      // Intro centralisée : jamais « page null » (texte collé, page absente…).
      this.sourceIntro.textContent = citationIntro(this.i18n, this.current.source_page);
      this.sourceText.textContent = this.current.source_excerpt;
      this.sourceBlock.hidden = false;
      this.manualBadge.hidden = true;
    } else {
      this.manualBadge.textContent = this.i18n.t("manual_badge");
      this.manualBadge.hidden = false;
      this.sourceBlock.hidden = true;
    }

    this.feedback.hidden = false;
    this.btnNext.hidden = false;
    this.btnNext.textContent = this.i18n.t(this.isLast ? "btn_finish" : "btn_next");
  }
}
