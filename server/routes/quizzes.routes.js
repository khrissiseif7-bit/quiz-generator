/**
 * quizzes.routes.js — Routes REST du CRUD (quiz, questions, tentatives, cours).
 *
 * COUCHE : Routes. Aucune logique : on enchaîne les middlewares puis on délègue
 * au controller.
 *
 * SÉCURITÉ (rappel) :
 *   - Le CODE D'ACCÈS (X-Access-Code) est requis sur les ÉCRITURES (POST/PUT/
 *     DELETE) et sur la génération, mais PAS sur les LECTURES (GET) : celles-ci
 *     ne consomment aucun quota LLM et restent protégées par le code de la
 *     ressource (6 caractères non devinables). Le texte d'un cours reste, lui,
 *     réservé à la bonne X-Owner-Key (voir courses.controller).
 *   - X-Owner-Key requis sur les écritures d'une RESSOURCE : PUT/DELETE d'un
 *     quiz, tout le CRUD des questions, PUT/DELETE d'un cours (ownerKeyRequired).
 *   - POST /quizzes est en plus limité à 10/h par IP (dans le controller).
 */

import { Router } from "express";
import { requireAccessCode } from "../middlewares/accessCode.js";
import { ownerKeyRequired } from "../middlewares/ownerKey.js";
import * as repo from "../services/quiz.repository.js";
import * as quizzes from "../controllers/quizzes.controller.js";
import * as courses from "../controllers/courses.controller.js";

const router = Router();

// Gardes de clé propriétaire (le SQL de lecture du hash reste dans le repository).
const proprietaireQuiz = ownerKeyRequired((req) => repo.ownerHashDuQuiz(req.params.code));
const proprietaireCours = ownerKeyRequired((req) => repo.ownerHashDuCours(req.params.code));

// ── LECTURES (pas de code d'accès : aucune consommation de quota LLM) ──────
router.get("/quizzes/:code", quizzes.lireQuiz);
router.get("/quizzes/:code/stats", quizzes.stats);
router.get("/courses/:code", courses.lireCours);

// ── ÉCRITURES (code d'accès requis ; clé propriétaire sur les mutations) ──
router.post("/quizzes", requireAccessCode, quizzes.creerQuiz);
router.put("/quizzes/:code", requireAccessCode, proprietaireQuiz, quizzes.majQuiz);
router.delete("/quizzes/:code", requireAccessCode, proprietaireQuiz, quizzes.supprimerQuiz);

router.post("/quizzes/:code/questions", requireAccessCode, proprietaireQuiz, quizzes.ajouterQuestion);
router.put("/quizzes/:code/questions/:id", requireAccessCode, proprietaireQuiz, quizzes.majQuestion);
router.delete("/quizzes/:code/questions/:id", requireAccessCode, proprietaireQuiz, quizzes.supprimerQuestion);

router.post("/quizzes/:code/attempts", requireAccessCode, quizzes.ajouterTentative);

router.post("/courses", requireAccessCode, courses.creerCours);
router.put("/courses/:code", requireAccessCode, proprietaireCours, courses.majCours);
router.delete("/courses/:code", requireAccessCode, proprietaireCours, courses.supprimerCours);

export default router;
