/**
 * citation.js — Formatage CENTRALISÉ du bloc « D'après le cours ».
 *
 * COUCHE : utilitaire de vue (sans DOM, sans état). Une seule source de vérité
 * pour décider si un numéro de page doit être affiché, réutilisée par QuizView,
 * ResultView et EditView (plutôt que de dupliquer la condition dans chaque vue).
 *
 * RÈGLE : un numéro de page n'est affiché que s'il est RÉELLEMENT exploitable.
 * Tous les cas « pas de page » convergent ici :
 *   - null / undefined (texte collé sans pagination, question ajoutée à la main) ;
 *   - la chaîne "null" ou "undefined" (valeur sérialisée par erreur / ancienne
 *     donnée en base) ;
 *   - chaîne vide, valeur non numérique, 0 ou négatif, non entier.
 * On n'affiche JAMAIS « page null », « page undefined » ni « page  » (vide).
 */

/**
 * Indique si `source_page` est un numéro de page affichable (entier ≥ 1).
 * @param {*} source_page
 * @returns {boolean}
 */
export function pageValide(source_page) {
  if (source_page == null) return false;                 // null OU undefined
  if (source_page === "null" || source_page === "undefined" || source_page === "") return false;
  const n = Number(source_page);
  return Number.isInteger(n) && n >= 1;
}

/**
 * Numéro de page normalisé (entier), ou null s'il n'est pas exploitable.
 * @param {*} source_page
 * @returns {number|null}
 */
export function pageNumero(source_page) {
  return pageValide(source_page) ? Number(source_page) : null;
}

/**
 * Libellé d'introduction de la citation, avec numéro de page si exploitable,
 * sinon « D'après le cours » seul (clé i18n `source_intro_nopage`).
 * @param {import("./I18n.js").I18n} i18n
 * @param {*} source_page
 * @returns {string}
 */
export function citationIntro(i18n, source_page) {
  return pageValide(source_page)
    ? i18n.t("source_intro", { page: Number(source_page) })
    : i18n.t("source_intro_nopage");
}
