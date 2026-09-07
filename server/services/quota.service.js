/**
 * quota.service.js — Limitation de débit EN MÉMOIRE (aucune persistance).
 *
 * COUCHE : Service (serveur).
 * RÔLE :
 *   - rate limit par IP sur une fenêtre glissante (RATE_LIMIT_PER_IP / WINDOW_MS),
 *   - compteur GLOBAL journalier (DAILY_GLOBAL_LIMIT), remis à zéro chaque jour.
 * Tout est stocké en mémoire vive (Map / compteurs) : l'état est perdu au
 * redémarrage, ce qui est acceptable pour ce projet pédagogique.
 * Dépassement -> le controller répond 429.
 */

/** @type {Map<string, number[]>} IP -> horodatages des requêtes récentes. */
// TODO: const ipHits = new Map();

/** Compteur global du jour. */
// TODO: let dailyCount = 0; let dailyKey = "<date du jour>";

/**
 * Vérifie et enregistre une requête pour une IP donnée.
 * @param {string} ip - Adresse IP de l'appelant (req.ip).
 * @param {object} [config] - Limites (par IP, fenêtre, global journalier).
 * @returns {{allowed:boolean, reason?:string}} Autorisation et motif si refus.
 */
export function checkQuota(ip, config) {
  // TODO: purger les horodatages hors fenêtre pour cette IP.
  // TODO: si le nombre dans la fenêtre >= limite IP -> { allowed:false, reason:"ip" }.
  // TODO: réinitialiser dailyCount si le jour a changé.
  // TODO: si dailyCount >= limite globale -> { allowed:false, reason:"daily" }.
  // TODO: sinon enregistrer l'appel (push horodatage, dailyCount++) -> { allowed:true }.
}
