/**
 * CourseStore.js — Mémoire locale des cours connus de CE navigateur.
 *
 * COUCHE : Service (front). C'est le SEUL usage de localStorage de toute
 * l'application (à documenter dans le README). On y conserve, pour chaque cours
 * créé depuis ce navigateur, le { code, ownerKey, title, language } — afin de
 * pouvoir lister « Mes cours », lire leur score (clé propriétaire requise) et
 * les rattacher/réviser sans compte utilisateur.
 *
 * On ne stocke JAMAIS le texte du cours ici (le principe « le cours n'est pas
 * stocké » vaut aussi côté navigateur) : seulement des identifiants et clés.
 */

const CLE = "quiz-generator:courses";

export class CourseStore {
  /** @returns {Array<{code:string, ownerKey:string, title:string, language:string}>} */
  all() {
    try {
      const brut = localStorage.getItem(CLE);
      const liste = brut ? JSON.parse(brut) : [];
      return Array.isArray(liste) ? liste : [];
    } catch {
      return []; // localStorage indisponible ou JSON corrompu : liste vide
    }
  }

  /** @param {string} code @returns {object|null} */
  get(code) {
    return this.all().find((c) => c.code === code) || null;
  }

  /**
   * Ajoute (ou remplace) un cours en tête de liste.
   * @param {{code:string, ownerKey:string, title:string, language:string}} cours
   */
  add(cours) {
    const liste = this.all().filter((c) => c.code !== cours.code);
    liste.unshift({ code: cours.code, ownerKey: cours.ownerKey, title: cours.title, language: cours.language });
    this._ecrire(liste);
  }

  /** @param {string} code */
  remove(code) {
    this._ecrire(this.all().filter((c) => c.code !== code));
  }

  _ecrire(liste) {
    try {
      localStorage.setItem(CLE, JSON.stringify(liste));
    } catch {
      /* stockage plein ou indisponible : on ignore (dégradation silencieuse) */
    }
  }
}
