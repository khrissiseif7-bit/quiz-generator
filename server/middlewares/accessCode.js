/**
 * accessCode.js — Middleware de contrôle du code d'accès.
 *
 * COUCHE : Middleware (serveur).
 * RÔLE : refuser (401) toute requête dont l'en-tête `X-Access-Code` ne
 * correspond pas à la variable d'environnement `ACCESS_CODE`.
 *
 * MODE DÉVELOPPEMENT : si `ACCESS_CODE` n'est pas défini dans l'environnement,
 * le middleware laisse tout passer (un avertissement est logué au démarrage
 * dans server.js). Cela évite d'avoir à configurer un code pour bricoler en local.
 */

/**
 * Middleware Express de vérification du code d'accès.
 * @param {import("express").Request} req - Requête (en-tête X-Access-Code attendu).
 * @param {import("express").Response} res - Réponse ; 401 { error:'INVALID_CODE' } si invalide.
 * @param {import("express").NextFunction} next - Middleware suivant si le code est valide.
 * @returns {void}
 */
export function requireAccessCode(req, res, next) {
  const codeAttendu = process.env.ACCESS_CODE;

  // Pas de code configuré -> mode développement, on laisse passer.
  if (!codeAttendu) {
    return next();
  }

  // En-têtes HTTP : toujours lus en minuscules par Express.
  const codeRecu = req.headers["x-access-code"];

  if (!codeRecu || codeRecu !== codeAttendu) {
    return res.status(401).json({ error: "INVALID_CODE" });
  }

  return next();
}
