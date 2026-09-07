/**
 * accessCode.js — Middleware de contrôle du code d'accès.
 *
 * COUCHE : Middleware (serveur).
 * RÔLE : refuser (401) toute requête dont l'en-tête `X-Access-Code` ne
 * correspond pas à la variable d'environnement `ACCESS_CODE`. Sécurité minimale
 * pour un projet étudiant, sans base d'utilisateurs.
 */

/**
 * Middleware Express de vérification du code d'accès.
 * @param {object} req - Requête (en-tête X-Access-Code attendu).
 * @param {object} res - Réponse ; renvoie 401 { error:{code:401,message} } si invalide.
 * @param {Function} next - Passe au middleware suivant si le code est valide.
 * @returns {void}
 */
export function requireAccessCode(req, res, next) {
  // TODO: lire le code depuis req.headers["x-access-code"].
  // TODO: comparer à process.env.ACCESS_CODE.
  // TODO: si absent/différent -> res.status(401).json({ error:{ code:401, message:"..." } }).
  // TODO: sinon next().
}
