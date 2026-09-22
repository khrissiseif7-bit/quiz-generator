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
    this.ringFill = document.getElementById("result-ring-fill");
    // Circonférence de l'anneau (r=52) : sert au calcul du stroke-dashoffset.
    this._circonference = 2 * Math.PI * 52;
    this.stats = document.getElementById("result-stats");
    this.missedTitle = document.getElementById("result-missed-title");
    this.missed = document.getElementById("result-missed");
    this.btnReplay = document.getElementById("btn-replay-errors");
    this.btnFlashcards = document.getElementById("btn-flashcards");
    this.btnNewQuiz = document.getElementById("btn-new-quiz");
    this.btnHomeReset = document.getElementById("btn-home-reset");

    this.btnReplay.addEventListener("click", () => this.bus.publish("ui:replay-errors", {}));
    this.btnFlashcards.addEventListener("click", () => this.bus.publish("ui:show-flashcards", {}));
    this.btnNewQuiz.addEventListener("click", () => this.bus.publish("ui:new-quiz", {}));
    this.btnHomeReset.addEventListener("click", () => this.bus.publish("ui:home-reset", {}));

    this.bus.subscribe("screen:show", ({ name }) => {
      this.section.hidden = name !== "result";
    });
    this.bus.subscribe("quiz:finished", (e) => this._render(e));
    // Statistiques renvoyées par le serveur après enregistrement de la tentative.
    this.bus.subscribe("result:stats", ({ stats }) => this._renderStats(stats));
  }

  /**
   * Affiche les statistiques du quiz (nombre de tentatives, moyenne, meilleur).
   * @param {{attempts:number, averageScore:number|null, bestScore:number|null}} stats
   */
  _renderStats(stats) {
    if (!stats || !stats.attempts) { this.stats.hidden = true; return; }
    const iso = (v) => this.i18n.isoLTR(`${Math.round(v)}%`);
    this.stats.textContent = this.i18n.t("result_stats", {
      attempts: this.i18n.isoLTR(String(stats.attempts)),
      avg: stats.averageScore != null ? iso(stats.averageScore) : "—",
      best: stats.bestScore != null ? iso(stats.bestScore) : "—",
    });
    this.stats.hidden = false;
  }

  /**
   * @param {{score:number, total:number, percent:number, missed:Array}} e
   */
  _render({ score, total, percent, missed }) {
    // Masque les stats : elles ne réapparaîtront que si le serveur en renvoie
    // (quiz enregistré). Un quiz non enregistré n'affiche pas de statistiques.
    this.stats.hidden = true;
    // Centre de l'anneau : pourcentage (grand) + score (petit), isolés en LTR
    // (sinon « 50% » et « 1 / 2 » s'inversent en arabe).
    this.percent.textContent = this.i18n.isoLTR(`${percent}%`);
    this.score.textContent = this.i18n.isoLTR(`${score} / ${total}`);

    // Anneau animé : on part de « vide » puis on anime jusqu'au pourcentage
    // (transition CSS sur stroke-dashoffset).
    const C = this._circonference;
    this.ringFill.style.strokeDasharray = String(C);
    this.ringFill.style.strokeDashoffset = String(C);
    void this.ringFill.getBoundingClientRect(); // reflow : la transition part de « vide »
    this.ringFill.style.strokeDashoffset = String(C * (1 - percent / 100));

    // Liste des questions ratées.
    this.missed.innerHTML = "";
    const yaDesErreurs = missed.length > 0;
    this.missedTitle.hidden = !yaDesErreurs;
    for (const item of missed) {
      const li = document.createElement("li");
      const q = document.createElement("div");
      q.className = "result-missed-q";
      q.textContent = item.question;
      const bonne = document.createElement("div");
      bonne.className = "correct-answer";
      bonne.textContent = `${this.i18n.t("result_correct_label")} ${item.correctText}`;
      li.appendChild(q);
      li.appendChild(bonne);
      // Question IA -> extrait source ; question ajoutée à la main -> badge
      // distinct (jamais « page null »).
      if (item.source_excerpt) {
        const src = document.createElement("div");
        src.className = "result-missed-src";
        // Pas de guillemets : la bordure --signature et l'italique marquent la citation.
        src.textContent = `${this.i18n.t("source_intro", { page: item.source_page })} — ${item.source_excerpt}`;
        li.appendChild(src);
      } else {
        const badge = document.createElement("div");
        badge.className = "result-missed-manual";
        badge.textContent = this.i18n.t("manual_badge");
        li.appendChild(badge);
      }
      this.missed.appendChild(li);
    }

    // « Rejouer les erreurs » n'a de sens que s'il y a des erreurs.
    this.btnReplay.disabled = !yaDesErreurs;
    // #11 : infobulle du bouton « Créer un nouveau quiz » (retour à l'accueil
    // pour un NOUVEAU contenu — pour rejouer, utiliser « Rejouer les erreurs »).
    this.btnNewQuiz.title = this.i18n.t("new_quiz_tip");
  }
}
