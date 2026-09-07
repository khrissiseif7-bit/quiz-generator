/**
 * quiz.controller.js — Controller HTTP de génération de quiz.
 *
 * COUCHE : Controller (serveur).
 * RÈGLE : le controller orchestre les Services (quota, llm, validation) mais ne
 * porte pas leur logique interne. Il lit la requête, applique le contrôle de
 * quota, appelle le service LLM, valide la sortie, puis renvoie la réponse au
 * format figé (/docs/contract.md) ou une erreur { error:{ code, message } }.
 */

// TODO: import { checkQuota } from "../services/quota.service.js";
// TODO: import { generateQuiz } from "../services/llm.service.js";
// TODO: import { validateQuiz } from "../services/validation.service.js";

/**
 * Handler de `POST /generate-quiz`.
 * @param {object} req - Requête Express ({ body:{text,language?,difficulty?,count?} }).
 * @param {object} res - Réponse Express.
 * @param {Function} next - Passe-plat vers le gestionnaire d'erreurs.
 * @returns {Promise<void>}
 */
export async function generate(req, res, next) {
  // TODO: appliquer checkQuota(req.ip) -> si dépassé, répondre 429.
  // TODO: extraire {text, language, difficulty, count} du body.
  // TODO: appeler generateQuiz(...) -> objet quiz brut (peut lever -> 502).
  // TODO: valider via validateQuiz(quiz, text) ; si invalide -> 502.
  // TODO: répondre 200 avec le quiz conforme au contrat.
  // TODO: en cas d'exception, déléguer à next(err).
}
