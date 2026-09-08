/**
 * quota.service.js — Limitation de débit EN MÉMOIRE (aucune persistance).
 *
 * COUCHE : Service (serveur).
 * RÔLE :
 *   - rate limit PAR IP : 5 requêtes / heure ET 20 / jour (fenêtres glissantes).
 *     Dépassement -> 429 { error:'RATE_LIMITED', retryAfterSeconds }.
 *   - compteur GLOBAL journalier : DAILY_GLOBAL_LIMIT requêtes toutes IP confondues,
 *     remis à zéro au changement de jour. Dépassement -> 503 { error:'DAILY_QUOTA_REACHED' }.
 *
 * Tout est stocké en mémoire vive : l'état est perdu au redémarrage, ce qui est
 * acceptable pour ce projet pédagogique. Un nettoyage périodique évite que la
 * Map ne grossisse indéfiniment.
 */

// --- Fenêtres de temps (constantes) ---
const UNE_HEURE_MS = 60 * 60 * 1000;
const UN_JOUR_MS = 24 * 60 * 60 * 1000;

// --- Limites (configurables par variables d'environnement) ---
const LIMITE_IP_HEURE = Number(process.env.RATE_LIMIT_PER_IP) || 5;
const LIMITE_IP_JOUR = Number(process.env.RATE_LIMIT_PER_IP_DAY) || 20;
const LIMITE_GLOBALE_JOUR = Number(process.env.DAILY_GLOBAL_LIMIT) || 500;

/**
 * Historique des requêtes par IP.
 * @type {Map<string, number[]>} IP -> liste d'horodatages (ms), triés croissants.
 */
const historiqueParIp = new Map();

/** Compteur global du jour courant et clé de jour associée. */
let compteurGlobalJour = 0;
let jourCourant = jourActuel();

/**
 * @returns {string} La date du jour au format AAAA-MM-JJ (pour détecter le changement de jour).
 */
function jourActuel() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Réinitialise le compteur global si l'on a changé de jour.
 * @returns {void}
 */
function rafraichirJourGlobal() {
  const aujourdhui = jourActuel();
  if (aujourdhui !== jourCourant) {
    jourCourant = aujourdhui;
    compteurGlobalJour = 0;
  }
}

/**
 * Vérifie les quotas pour une IP et, si tout est bon, ENREGISTRE la requête.
 * @param {string} ip - Adresse IP de l'appelant (req.ip).
 * @returns {{allowed:true} | {allowed:false, statusCode:number, error:string, retryAfterSeconds?:number}}
 *          Autorisation, ou refus avec le code HTTP et le motif à renvoyer.
 */
export function checkQuota(ip) {
  const maintenant = Date.now();

  // 1) Purge des horodatages de cette IP au-delà de 24 h (fenêtre glissante).
  const horodatages = (historiqueParIp.get(ip) || []).filter(
    (t) => maintenant - t < UN_JOUR_MS
  );

  // 2) Limite horaire : nombre de requêtes dans la dernière heure.
  const dansLHeure = horodatages.filter((t) => maintenant - t < UNE_HEURE_MS);
  if (dansLHeure.length >= LIMITE_IP_HEURE) {
    const plusAncienneHeure = dansLHeure[0];
    const retryAfterSeconds = Math.ceil(
      (UNE_HEURE_MS - (maintenant - plusAncienneHeure)) / 1000
    );
    historiqueParIp.set(ip, horodatages); // on mémorise la purge
    return { allowed: false, statusCode: 429, error: "RATE_LIMITED", retryAfterSeconds };
  }

  // 3) Limite journalière par IP.
  if (horodatages.length >= LIMITE_IP_JOUR) {
    const plusAncienneJour = horodatages[0];
    const retryAfterSeconds = Math.ceil(
      (UN_JOUR_MS - (maintenant - plusAncienneJour)) / 1000
    );
    historiqueParIp.set(ip, horodatages);
    return { allowed: false, statusCode: 429, error: "RATE_LIMITED", retryAfterSeconds };
  }

  // 4) Quota global journalier (toutes IP confondues).
  rafraichirJourGlobal();
  if (compteurGlobalJour >= LIMITE_GLOBALE_JOUR) {
    historiqueParIp.set(ip, horodatages);
    return { allowed: false, statusCode: 503, error: "DAILY_QUOTA_REACHED" };
  }

  // 5) Tout est bon : on enregistre la requête.
  horodatages.push(maintenant);
  historiqueParIp.set(ip, horodatages);
  compteurGlobalJour += 1;

  return { allowed: true };
}

/**
 * Nettoie la Map : retire les IP dont toutes les requêtes datent de plus de 24 h.
 * Appelée périodiquement pour éviter une fuite mémoire.
 * @returns {void}
 */
export function nettoyer() {
  const maintenant = Date.now();
  for (const [ip, horodatages] of historiqueParIp) {
    const recents = horodatages.filter((t) => maintenant - t < UN_JOUR_MS);
    if (recents.length === 0) {
      historiqueParIp.delete(ip);
    } else {
      historiqueParIp.set(ip, recents);
    }
  }
}

// Nettoyage automatique toutes les heures. .unref() : ce timer n'empêche pas
// le process de se terminer (utile pour les scripts et les tests).
const timerNettoyage = setInterval(nettoyer, UNE_HEURE_MS);
if (typeof timerNettoyage.unref === "function") {
  timerNettoyage.unref();
}
