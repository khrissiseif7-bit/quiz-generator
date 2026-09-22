/**
 * DocumentModel.js — État du document source (le cours collé).
 *
 * COUCHE : Model. Ne touche JAMAIS au DOM ; notifie via l'EventBus.
 * RESPONSABILITÉ : mémoriser le texte source et calculer sa VALIDITÉ de taille
 * (règle métier : min 300, max MAX_TEXT_LENGTH). La View ne fait qu'afficher
 * les indicateurs calculés ici.
 */

// Bornes de taille. MIN reflète le seuil serveur (limits.js) ; MAX reflète la
// valeur par défaut de MAX_TEXT_LENGTH côté serveur (abaissée à 30000 pour
// éviter les timeouts de génération). WARN = seuil d'avertissement « texte long ».
export const MIN_LEN = 300;
export const MAX_LEN = 30000;
export const WARN_LEN = 20000;

export class DocumentModel {
  /**
   * @param {import("../services/EventBus.js").EventBus} bus
   */
  constructor(bus) {
    this.bus = bus;
    this.text = "";
  }

  /**
   * Définit le texte source et publie l'état (longueur + validité).
   * @param {string} text
   * @returns {void}
   */
  setText(text) {
    this.text = text || "";
    const length = this.text.trim().length;
    const tooShort = length < MIN_LEN;
    const tooLong = length > MAX_LEN;
    this.bus.publish("document:changed", {
      length,
      tooShort,
      tooLong,
      valid: !tooShort && !tooLong,
      manque: tooShort ? MIN_LEN - length : 0, // caractères manquants
      long: !tooShort && !tooLong && length > WARN_LEN, // génération longue à prévoir
    });
  }

  /** @returns {string} Le texte source courant. */
  getText() {
    return this.text;
  }
}
