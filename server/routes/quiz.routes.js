/**
 * quiz.routes.js — Déclaration des routes du quiz.
 *
 * COUCHE : Routes.
 * RÈGLE : les routes ne portent AUCUNE logique métier. Elles enchaînent les
 * middlewares puis délèguent au controller.
 *
 * Chaîne de la route POST /generate-quiz :
 *   accessCode (401) -> limits (400/413) -> quiz.controller.generate
 *   (le quota 429/503 est appliqué dans le controller, au plus près de l'IP).
 */

import { Router } from "express";
import { requireAccessCode } from "../middlewares/accessCode.js";
import { enforceLimits } from "../middlewares/limits.js";
import { generate } from "../controllers/quiz.controller.js";

const router = Router();

router.post("/generate-quiz", requireAccessCode, enforceLimits, generate);

export default router;
