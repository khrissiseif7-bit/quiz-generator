/**
 * limits.js — Middleware de limites de taille.
 *
 * COUCHE : Middleware (serveur).
 * RÔLE : refuser (413) les requêtes dont le corps dépasse MAX_BODY_BYTES ou
 * dont le texte source dépasse MAX_TEXT_LENGTH caractères. Protège le service
 * LLM et les quotas contre des entrées trop volumineuses.
 *
 * NB : la limite d'octets du corps peut aussi être posée au niveau
 * express.json({ limit }) dans server.js ; ce middleware vérifie en plus la
 * longueur métier du champ `text`.
 */

/**
 * Middleware Express de contrôle des limites de taille.
 * @param {object} req - Requête ({ body:{ text } }).
 * @param {object} res - Réponse ; renvoie 413 { error:{code:413,message} } si dépassement.
 * @param {Function} next - Passe au middleware suivant si tout est dans les limites.
 * @returns {void}
 */
export function enforceLimits(req, res, next) {
  // TODO: vérifier la longueur de req.body.text vs process.env.MAX_TEXT_LENGTH.
  // TODO: (optionnel) vérifier la taille du corps vs MAX_BODY_BYTES si non couvert amont.
  // TODO: si dépassement -> res.status(413).json({ error:{ code:413, message:"..." } }).
  // TODO: sinon next().
}
