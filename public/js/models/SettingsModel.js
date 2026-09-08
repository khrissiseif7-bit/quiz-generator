/**
 * SettingsModel.js — Préférences de génération + code d'accès.
 *
 * COUCHE : Model. Ne touche JAMAIS au DOM ; publie via l'EventBus.
 * RESPONSABILITÉ : langue, difficulté, nombre de questions, et code d'accès.
 * Le code d'accès est gardé EN MÉMOIRE le temps de la session uniquement
 * (aucun stockage navigateur : ni localStorage ni cookie).
 */
export class SettingsModel {
  /**
   * @param {import("../services/EventBus.js").EventBus} bus
   */
  constructor(bus) {
    this.bus = bus;
    this.language = "auto";     // auto | fr | ar | en
    this.difficulty = "medium"; // easy | medium | hard
    this.count = 10;            // 5 | 10 | 15
    this.accessCode = "";       // en mémoire seulement
  }

  /** @param {"auto"|"fr"|"ar"|"en"} language */
  setLanguage(language) { this.language = language; this._changed(); }

  /** @param {"easy"|"medium"|"hard"} difficulty */
  setDifficulty(difficulty) { this.difficulty = difficulty; this._changed(); }

  /** @param {number} count */
  setCount(count) { this.count = Number(count); this._changed(); }

  /** @param {string} code - Code d'accès (non persisté). */
  setAccessCode(code) { this.accessCode = code || ""; }

  /** @returns {string} Code d'accès courant. */
  getAccessCode() { return this.accessCode; }

  /**
   * @returns {{language:string, difficulty:string, questionCount:number}}
   *          Corps prêt pour ApiClient (respecte les noms du contrat).
   */
  toRequest() {
    return {
      language: this.language,
      difficulty: this.difficulty,
      questionCount: this.count,
    };
  }

  _changed() {
    this.bus.publish("settings:changed", {
      language: this.language,
      difficulty: this.difficulty,
      count: this.count,
    });
  }
}
