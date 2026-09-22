/**
 * LoadingView.js — Écran d'attente pendant la génération (15–25 s).
 *
 * COUCHE : View. Aucune logique métier. Affiche 3 étapes qui s'allument
 * successivement (piloté par le contrôleur via "app:loading-step") au-dessus
 * d'un spinner et d'une barre indéterminée qui bougent EN CONTINU (CSS), pour
 * ne jamais donner l'impression d'un écran figé.
 */
export class LoadingView {
  /**
   * @param {import("../services/EventBus.js").EventBus} bus
   * @param {import("../services/I18n.js").I18n} i18n
   */
  constructor(bus, i18n) {
    this.bus = bus;
    this.i18n = i18n;
    this.section = document.getElementById("screen-loading");
    this.steps = Array.from(document.querySelectorAll("#loading-steps li"));
    this.btnCancel = document.getElementById("btn-cancel");
    this.eta = document.getElementById("loading-eta");
    this.fill = document.getElementById("loading-fill");
    this._etaTimer = null;

    // Annulation : on émet seulement l'intention ; la logique appartient au
    // Controller/Service (abort de la requête), jamais à la View.
    this.btnCancel.addEventListener("click", () => this.bus.publish("ui:cancel", {}));

    this.bus.subscribe("screen:show", ({ name }) => {
      this.section.hidden = name !== "loading";
      if (name === "loading") this._setStep(0);
      else { this._stopEta(); this._resetFill(); } // quitter l'attente : stop
    });
    this.bus.subscribe("app:loading-step", ({ step }) => this._setStep(step));
    // Estimation de durée fournie par le Controller (calculée sur la longueur).
    this.bus.subscribe("app:loading-eta", ({ seconds }) => this._startEta(seconds));
  }

  /**
   * Affiche une FOURCHETTE d'attente (la durée réelle varie d'un tirage LLM à
   * l'autre) plutôt qu'un chiffre unique trompeur.
   * @param {number} seconds - Estimation centrale (secondes).
   */
  _startEta(seconds) {
    this._stopEta();
    // Fourchette : ~[0,80×, 1,40×] de l'estimation centrale (données HTTP réelles).
    const lo = Math.max(1, Math.round(seconds * 0.80));
    const hi = Math.max(lo + 2, Math.round(seconds * 1.40));
    this.eta.textContent = this.i18n.t("loading_eta_range", { range: this.i18n.isoLTR(`${lo}–${hi}`) });

    // Barre qui se remplit sur la BORNE HAUTE, jusqu'à 92 % : on n'atteint le
    // plein qu'à la vraie fin de la génération.
    this._resetFill();
    void this.fill.getBoundingClientRect(); // reflow : repartir de 0
    this.fill.style.transition = `width ${hi}s linear`;
    this.fill.style.width = "92%";

    // Passé la borne haute, on bascule sur « Presque terminé… ».
    this._etaTimer = setTimeout(() => { this.eta.textContent = this.i18n.t("loading_eta_done"); }, hi * 1000);
  }

  /** Remet la barre de remplissage à zéro (sans transition). */
  _resetFill() {
    this.fill.style.transition = "none";
    this.fill.style.width = "0%";
  }

  _stopEta() {
    if (this._etaTimer) { clearTimeout(this._etaTimer); this._etaTimer = null; }
  }

  /**
   * Marque les étapes : avant l'étape courante = terminées, l'étape courante =
   * active, les suivantes = neutres.
   * @param {number} step - Index de l'étape en cours (0..2).
   */
  _setStep(step) {
    this.steps.forEach((li, i) => {
      li.classList.toggle("done", i < step);
      li.classList.toggle("active", i === step);
    });
  }
}
