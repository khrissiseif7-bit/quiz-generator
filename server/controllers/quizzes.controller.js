/**
 * quizzes.controller.js — Controllers du CRUD REST des quiz.
 *
 * COUCHE : Controller (serveur). Orchestre repository + services, applique les
 * règles métier (quota, validation, plancher de 3 questions, mise à jour du
 * score du cours), et renvoie des codes d'erreur HOMOGÈNES :
 *   404 NOT_FOUND · 403 FORBIDDEN · 400 VALIDATION_ERROR (détail des champs)
 *   · 409 CONFLICT · 429 RATE_LIMITED.
 *
 * PRINCIPE DIRECTEUR : on enregistre le QUIZ, jamais le texte du cours. Le corps
 * de POST /quizzes ne transporte pas le texte, seulement sa LONGUEUR
 * (source_length) et, pour chaque question, l'extrait déjà validé.
 */

import * as repo from "../services/quiz.repository.js";
import { validerCorpsQuestion } from "../services/validation.service.js";
import { checkCreateQuizQuota } from "../services/quota.service.js";
import { genererCleProprietaire, hacher } from "../services/security.service.js";
import { calculerNouveauScore } from "../services/score.service.js";

const LANGUES_OK = ["fr", "ar", "en"];
const DIFFICULTES_OK = ["easy", "medium", "hard"];
const MIN_QUESTIONS = 3; // un quiz garde toujours au moins 3 questions

/** Réponse 400 homogène avec le détail des champs fautifs. */
function erreurValidation(res, errors) {
  return res.status(400).json({ error: "VALIDATION_ERROR", details: errors });
}

/** Retire le hash propriétaire avant d'envoyer un quiz au client. */
function sansHash(quiz) {
  const { owner_key_hash, ...reste } = quiz;
  return reste;
}

/**
 * POST /quizzes — enregistre un quiz complet. 201 { code, ownerKey }.
 */
export function creerQuiz(req, res) {
  // 1) Quota : 10 enregistrements par heure et par IP.
  const quota = checkCreateQuizQuota(req.ip);
  if (!quota.allowed) {
    return res.status(quota.statusCode)
      .json({ error: quota.error, retryAfterSeconds: quota.retryAfterSeconds });
  }

  const body = req.body || {};
  const errors = [];

  // 2) Métadonnées.
  if (typeof body.title !== "string" || body.title.trim() === "") {
    errors.push({ field: "title", code: "REQUIRED" });
  }
  if (!LANGUES_OK.includes(body.language)) {
    errors.push({ field: "language", code: "INVALID_VALUE" });
  }
  if (!DIFFICULTES_OK.includes(body.difficulty)) {
    errors.push({ field: "difficulty", code: "INVALID_VALUE" });
  }
  if (!Number.isInteger(body.source_length) || body.source_length < 0) {
    errors.push({ field: "source_length", code: "INVALID_VALUE" });
  }

  // 3) Questions : au moins 3, chacune valide.
  const questions = Array.isArray(body.questions) ? body.questions : [];
  if (questions.length < MIN_QUESTIONS) {
    errors.push({ field: "questions", code: "MIN_QUESTIONS" });
  }
  questions.forEach((q, i) => {
    const v = validerCorpsQuestion(q);
    if (!v.valid) v.errors.forEach((e) => errors.push({ field: `questions[${i}].${e.field}`, code: e.code }));
  });

  // 4) Cours de rattachement facultatif : doit exister ET appartenir à
  //    l'appelant. Rattacher un quiz est une écriture sur le cours : on exige
  //    donc la clé propriétaire du COURS (X-Owner-Key).
  let courseCode = null;
  if (body.course_code != null && body.course_code !== "") {
    const cours = repo.lireCours(body.course_code);
    if (!cours) {
      errors.push({ field: "course_code", code: "NOT_FOUND" });
    } else {
      const cle = req.headers["x-owner-key"];
      if (!cle || hacher(cle) !== cours.owner_key_hash) {
        return res.status(403).json({ error: "FORBIDDEN" });
      }
      courseCode = body.course_code;
    }
  }

  if (errors.length) return erreurValidation(res, errors);

  // 5) Génération du code + clé propriétaire (clé renvoyée UNE seule fois).
  const code = repo.nouveauCodeQuiz();
  const ownerKey = genererCleProprietaire();

  repo.creerQuiz({
    code,
    title: body.title.trim(),
    language: body.language,
    difficulty: body.difficulty,
    questionCount: questions.length,
    sourceLength: body.source_length,
    createdAt: Date.now(),
    ownerKeyHash: hacher(ownerKey),
    courseCode,
    questions: questions.map((q) => ({
      question: q.question,
      choices: q.choices,
      correct_index: q.correct_index,
      explanation: q.explanation,
      source_excerpt: q.source_excerpt ?? null,
      source_page: q.source_page ?? null,
      origin: q.origin === "manual" ? "manual" : "ai",
    })),
    flashcards: Array.isArray(body.flashcards) ? body.flashcards : [],
  });

  return res.status(201).json({ code, ownerKey });
}

/**
 * GET /quizzes/:code — quiz complet (sans le hash propriétaire).
 */
export function lireQuiz(req, res) {
  const quiz = repo.lireQuizComplet(req.params.code);
  if (!quiz) return res.status(404).json({ error: "NOT_FOUND" });
  return res.json(sansHash(quiz));
}

/**
 * PUT /quizzes/:code — modifie le titre uniquement (clé propriétaire requise).
 */
export function majQuiz(req, res) {
  const { title } = req.body || {};
  if (typeof title !== "string" || title.trim() === "") {
    return erreurValidation(res, [{ field: "title", code: "REQUIRED" }]);
  }
  repo.majTitreQuiz(req.params.code, title.trim());
  return res.json({ code: req.params.code, title: title.trim() });
}

/**
 * DELETE /quizzes/:code — supprime le quiz (cascade questions/flashcards/tentatives).
 */
export function supprimerQuiz(req, res) {
  repo.supprimerQuiz(req.params.code);
  return res.status(204).end();
}

/**
 * POST /quizzes/:code/questions — ajoute une question (origin forcé à 'manual').
 */
export function ajouterQuestion(req, res) {
  const v = validerCorpsQuestion(req.body);
  if (!v.valid) return erreurValidation(res, v.errors);

  const creee = repo.ajouterQuestion(req.params.code, {
    question: req.body.question,
    choices: req.body.choices,
    correct_index: req.body.correct_index,
    explanation: req.body.explanation,
    origin: "manual",         // imposé : une question saisie n'a pas d'extrait source
    source_excerpt: null,
    source_page: null,
  });
  return res.status(201).json(creee);
}

/**
 * PUT /quizzes/:code/questions/:id — modifie une question.
 */
export function majQuestion(req, res) {
  const id = Number(req.params.id);
  if (!repo.lireQuestion(req.params.code, id)) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }
  const v = validerCorpsQuestion(req.body);
  if (!v.valid) return erreurValidation(res, v.errors);

  const maj = repo.majQuestion(req.params.code, id, {
    question: req.body.question,
    choices: req.body.choices,
    correct_index: req.body.correct_index,
    explanation: req.body.explanation,
  });
  return res.json(maj);
}

/**
 * DELETE /quizzes/:code/questions/:id — supprime une question.
 * Refus 409 s'il resterait moins de 3 questions.
 */
export function supprimerQuestion(req, res) {
  const id = Number(req.params.id);
  if (!repo.lireQuestion(req.params.code, id)) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }
  if (repo.compterQuestions(req.params.code) <= MIN_QUESTIONS) {
    return res.status(409).json({ error: "CONFLICT", reason: "MIN_QUESTIONS" });
  }
  repo.supprimerQuestion(req.params.code, id);
  return res.status(204).end();
}

/**
 * POST /quizzes/:code/attempts — enregistre une tentative et met à jour le
 * score du cours rattaché (le cas échéant). 201 { attempt, stats }.
 */
export function ajouterTentative(req, res) {
  if (!repo.quizExiste(req.params.code)) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }
  const { score, total } = req.body || {};
  if (!Number.isInteger(score) || !Number.isInteger(total) || total <= 0 || score < 0 || score > total) {
    return erreurValidation(res, [{ field: "score", code: "INVALID_VALUE" }]);
  }

  const createdAt = Date.now();
  repo.ajouterTentative(req.params.code, score, total, createdAt);

  // Met à jour le score du cours rattaché (moyenne pondérée, service pur).
  const courseCode = repo.courseCodeDuQuiz(req.params.code);
  if (courseCode) {
    const cours = repo.lireCours(courseCode);
    const nouveau = calculerNouveauScore(cours ? cours.score : null, score, total);
    repo.majScoreCours(courseCode, nouveau, createdAt);
  }

  return res.status(201).json({
    attempt: { score, total, created_at: createdAt },
    stats: repo.statsQuiz(req.params.code),
  });
}

/**
 * GET /quizzes/:code/stats — { attempts, averageScore, bestScore }.
 */
export function stats(req, res) {
  if (!repo.quizExiste(req.params.code)) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }
  return res.json(repo.statsQuiz(req.params.code));
}
