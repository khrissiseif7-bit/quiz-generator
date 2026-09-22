/**
 * score.service.js — Calcul du score de révision d'un cours.
 *
 * COUCHE : Service (serveur) PUR : aucune dépendance à SQL ni au réseau, donc
 * facilement testable en isolation.
 *
 * DEUX NOTIONS DISTINCTES :
 *   1. le score STOCKÉ (courses.score) : mémoire de la maîtrise, mise à jour à
 *      chaque tentative par une moyenne pondérée qui privilégie la tentative
 *      récente sans oublier le passé ;
 *   2. le score AFFICHÉ : le score stocké atténué par le temps écoulé depuis la
 *      dernière révision (courbe de l'oubli). Le score stocké ne change PAS avec
 *      le temps ; seule la valeur affichée décroît.
 *
 * FORMULES :
 *   - tentative en pourcentage : p = score_tentative / total * 100 ;
 *   - première tentative        : score = p (résultat brut) ;
 *   - tentatives suivantes      : score = 0.6 * p + 0.4 * score_précédent ;
 *   - score affiché             : score_affiché = score * exp(-jours / 14),
 *                                 borné à 0 (jamais négatif).
 *
 * Le facteur 14 (jours) est la « constante de temps » de l'oubli : au bout de
 * ~14 jours sans réviser, le score affiché tombe à ~37 % (1/e) du score stocké.
 */

// Constante de temps de la courbe de l'oubli, en jours.
export const TAU_JOURS = 14;

/**
 * Calcule le nouveau score STOCKÉ après une tentative.
 * @param {number|null} scorePrecedent - Score stocké précédent (null si aucune tentative).
 * @param {number} scoreTentative - Bonnes réponses de la tentative.
 * @param {number} total - Nombre total de questions de la tentative.
 * @returns {number} Nouveau score stocké, entre 0 et 100.
 */
export function calculerNouveauScore(scorePrecedent, scoreTentative, total) {
  const pourcentage = total > 0 ? (scoreTentative / total) * 100 : 0;
  if (scorePrecedent == null) return arrondir(pourcentage);
  return arrondir(0.6 * pourcentage + 0.4 * scorePrecedent);
}

/**
 * Applique la courbe de l'oubli au score stocké selon le nombre de jours écoulés.
 * @param {number|null} scoreStocke - Score stocké (null si aucune tentative).
 * @param {number} jours - Jours depuis la dernière tentative (>= 0).
 * @returns {number|null} Score affiché (0..100), ou null si pas de score stocké.
 */
export function scoreAffiche(scoreStocke, jours) {
  if (scoreStocke == null) return null;
  const j = Math.max(0, jours); // une horloge décalée ne doit pas « augmenter » le score
  const affiche = scoreStocke * Math.exp(-j / TAU_JOURS);
  return arrondir(Math.max(0, affiche));
}

/**
 * Nombre de jours (fractionnaire) entre deux horodatages en millisecondes.
 * @param {number} depuisMs - Horodatage de départ (ms epoch).
 * @param {number} [maintenantMs=Date.now()] - Horodatage courant (ms epoch).
 * @returns {number} Jours écoulés (>= 0).
 */
export function joursDepuis(depuisMs, maintenantMs = Date.now()) {
  if (!depuisMs) return 0;
  return Math.max(0, (maintenantMs - depuisMs) / (24 * 60 * 60 * 1000));
}

/** Arrondit à une décimale (lisibilité des scores). */
function arrondir(x) {
  return Math.round(x * 10) / 10;
}
