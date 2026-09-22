/**
 * SettingsModel.js — Préférences de génération + code d'accès.
 *
 * COUCHE : Model. Ne touche JAMAIS au DOM ; publie via l'EventBus.
 * RESPONSABILITÉ : langue, difficulté, nombre de questions, et code d'accès.
 * Le code d'accès n'est conservé QU'EN MÉMOIRE (durée de vie de la page) : il
 * est OUBLIÉ à chaque rechargement (F5) et n'est jamais écrit dans le stockage
 * du navigateur (ni localStorage ni sessionStorage).
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
    // Code d'accès : gardé UNIQUEMENT en mémoire. Repart vide à chaque
    // chargement de page (aucune persistance : rien à restaurer au démarrage).
    this.accessCode = "";

    // Options « cours » (consommées par l'enregistrement) :
    this.attachToCourses = true;   // rattacher le quiz à un cours (par défaut oui)
    this.storeCourseText = true;   // conserver le texte du cours (par défaut oui, si rattaché)
  }

  /** @param {boolean} v */
  setAttachToCourses(v) { this.attachToCourses = !!v; }
  /** @param {boolean} v */
  setStoreCourseText(v) { this.storeCourseText = !!v; }

  /**
   * Recommande un nombre de questions selon la longueur et la structure du texte.
   * Heuristique CLIENT instantanée : < 3000 caractères -> 5 ; 3000–8000 -> 10 ;
   * au-delà -> 15 ; +5 si plus de 8 sections détectées. Le résultat est TOUJOURS
   * arrondi au palier le plus proche parmi {5, 10, 15} (jamais de valeur
   * intermédiaire, quels que soient les ajustements).
   * @param {string} text
   * @returns {5|10|15}
   */
  recommendCount(text) {
    const len = (text || "").length;
    let brut = len < 3000 ? 5 : len <= 8000 ? 10 : 15;
    if (compterSections(text || "") > 8) brut += 5;
    return arrondirPalier(brut);
  }

  /** @param {"auto"|"fr"|"ar"|"en"} language */
  setLanguage(language) { this.language = language; this._changed(); }

  /** @param {"easy"|"medium"|"hard"} difficulty */
  setDifficulty(difficulty) { this.difficulty = difficulty; this._changed(); }

  /** @param {number} count */
  setCount(count) { this.count = Number(count); this._changed(); }

  /**
   * @param {string} code - Code d'accès. Gardé UNIQUEMENT en mémoire : aucune
   * écriture dans le stockage du navigateur, donc oublié au rechargement.
   */
  setAccessCode(code) {
    this.accessCode = code || "";
  }

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

/** Arrondit une valeur au palier le plus proche parmi {5, 10, 15}. */
function arrondirPalier(v) {
  return [5, 10, 15].reduce((meilleur, p) => (Math.abs(p - v) < Math.abs(meilleur - v) ? p : meilleur), 5);
}

/**
 * Compte les « sections » d'un texte : lignes numérotées (« 1. », « 2) ») ou
 * titres markdown (« # … »). Sert à ajuster la recommandation à la hausse.
 * @param {string} text
 * @returns {number}
 */
function compterSections(text) {
  let n = 0;
  for (const ligne of text.split("\n")) {
    if (/^\s*\d+\s*[.)]\s/.test(ligne) || /^\s*#{1,6}\s/.test(ligne)) n++;
  }
  return n;
}
