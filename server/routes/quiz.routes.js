/**
 * quiz.routes.js — Déclaration des routes du quiz.
 *
 * COUCHE : Routes.
 * RÈGLE : les routes ne contiennent AUCUNE logique métier. Elles se limitent à
 * enchaîner les middlewares puis à déléguer au controller.
 *
 * Chaîne de la route POST /generate-quiz :
 *   accessCode -> limits -> quota(service via controller) -> quiz.controller.generate
 */

// TODO: import { Router } from "express";
// TODO: import { requireAccessCode } from "../middlewares/accessCode.js";
// TODO: import { enforceLimits } from "../middlewares/limits.js";
// TODO: import { generate } from "../controllers/quiz.controller.js";

/**
 * Fabrique le routeur du module quiz.
 * @returns {object} Un Router Express avec les routes montées.
 */
export function createQuizRouter() {
  // TODO: const router = Router();
  // TODO: router.post("/generate-quiz", requireAccessCode, enforceLimits, generate);
  // TODO: return router;
}

// TODO: export default createQuizRouter();
