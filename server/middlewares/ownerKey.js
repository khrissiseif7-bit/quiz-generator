/**
 * ownerKey.js — Middleware de contrôle de la CLÉ PROPRIÉTAIRE.
 *
 * COUCHE : Middleware (serveur).
 * RÔLE : protéger les opérations d'écriture d'une ressource (modifier/supprimer
 * un quiz, tout le CRUD des questions, modifier/supprimer un cours). L'appelant
 * doit fournir l'en-tête `X-Owner-Key` ; on compare son hash SHA-256 au hash
 * stocké à la création. Aucune clé n'est jamais conservée en clair.
 *
 * Décisions :
 *   - ressource introuvable            -> 404 { error:'NOT_FOUND' } ;
 *   - clé absente ou hash différent    -> 403 { error:'FORBIDDEN' }.
 *
 * FABRIQUE : le middleware ne connaît pas la base ; on lui passe une fonction
 * qui, à partir de la requête, renvoie le hash stocké de la ressource visée
 * (quiz ou cours). Ainsi le SQL reste dans le repository.
 */

import { hacher } from "../services/security.service.js";

/**
 * Construit un middleware exigeant la bonne clé propriétaire.
 * @param {(req: import("express").Request) => string|null} recupererHash
 *        Renvoie le hash propriétaire stocké de la ressource, ou null si absente.
 * @returns {import("express").RequestHandler}
 */
export function ownerKeyRequired(recupererHash) {
  return (req, res, next) => {
    const hashStocke = recupererHash(req);
    if (hashStocke == null) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }
    const cleFournie = req.headers["x-owner-key"];
    if (!cleFournie || hacher(cleFournie) !== hashStocke) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }
    return next();
  };
}
