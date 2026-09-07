/**
 * SettingsModel.js — Préférences de génération du quiz.
 *
 * COUCHE : Model.
 * RÈGLE : ne touche JAMAIS au DOM. Publie ses changements via l'EventBus.
 *
 * RESPONSABILITÉ : mémoriser la langue choisie, la difficulté et le nombre
 * de questions demandé. Ces valeurs sont lues par UploadController pour
 * construire la requête envoyée à ApiClient.
 */
export class SettingsModel {
  /**
   * @param {import("../services/EventBus.js").EventBus} bus - Bus d'événements partagé.
   */
  constructor(bus) {
    // TODO: mémoriser le bus.
    // TODO: initialiser des valeurs par défaut :
    //       language ("fr"), difficulty ("medium"), count (10).
  }

  /**
   * @param {"fr"|"ar"|"en"} language - Langue cible du quiz.
   * @returns {void}
   */
  setLanguage(language) {
    // TODO: stocker language, publier "settings:changed".
  }

  /**
   * @param {"easy"|"medium"|"hard"} difficulty - Difficulté cible.
   * @returns {void}
   */
  setDifficulty(difficulty) {
    // TODO: stocker difficulty, publier "settings:changed".
  }

  /**
   * @param {number} count - Nombre de questions demandé (borné, ex. 1..20).
   * @returns {void}
   */
  setCount(count) {
    // TODO: stocker count (borné), publier "settings:changed".
  }

  /**
   * @returns {{language:string, difficulty:string, count:number}} Copie des réglages courants.
   */
  toJSON() {
    // TODO: retourner un objet plat des réglages.
  }
}
