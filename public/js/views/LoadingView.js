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

    this.bus.subscribe("screen:show", ({ name }) => {
      this.section.hidden = name !== "loading";
      if (name === "loading") this._setStep(0);
    });
    this.bus.subscribe("app:loading-step", ({ step }) => this._setStep(step));
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
