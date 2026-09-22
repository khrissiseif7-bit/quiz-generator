/**
 * quiz.repository.js — Accès aux données (le SEUL endroit où vit du SQL).
 *
 * COUCHE : Repository (serveur). Toutes les requêtes sont PRÉPARÉES (paramètres
 * liés `?`), JAMAIS construites par concaténation de chaînes : c'est la garantie
 * anti-injection SQL. Aucune règle métier ici (elle vit dans les controllers et
 * les services) — uniquement lire/écrire la base.
 *
 * PRINCIPE DIRECTEUR : on stocke le QUIZ, jamais le texte du cours. Les quiz et
 * questions ne portent aucun texte de cours (seulement source_length et
 * l'extrait cité). Le texte n'est conservé que dans courses.text, et UNIQUEMENT
 * si l'utilisateur l'a explicitement demandé (voir courses.controller.js).
 */

import db from "../db/connection.js";
import { genererCode } from "./security.service.js";

/**
 * Exécute une fonction dans une TRANSACTION (tout ou rien).
 * node:sqlite (DatabaseSync) n'a pas d'assistant de transaction : on gère
 * BEGIN / COMMIT / ROLLBACK à la main.
 * @template T
 * @param {() => T} fn - Travail à effectuer dans la transaction.
 * @returns {T}
 */
function transaction(fn) {
  db.exec("BEGIN");
  try {
    const resultat = fn();
    db.exec("COMMIT");
    return resultat;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Requêtes préparées (compilées une fois au chargement du module).
// ─────────────────────────────────────────────────────────────────────────
const stmt = {
  // Existence / propriétaire.
  quizExiste: db.prepare("SELECT 1 FROM quizzes WHERE code = ?"),
  coursExiste: db.prepare("SELECT 1 FROM courses WHERE code = ?"),
  ownerQuiz: db.prepare("SELECT owner_key_hash FROM quizzes WHERE code = ?"),
  ownerCours: db.prepare("SELECT owner_key_hash FROM courses WHERE code = ?"),
  courseCodeDuQuiz: db.prepare("SELECT course_code FROM quizzes WHERE code = ?"),

  // Quiz.
  insererQuiz: db.prepare(`INSERT INTO quizzes
    (code, title, language, difficulty, question_count, source_length, created_at, owner_key_hash, course_code)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  lireQuiz: db.prepare("SELECT * FROM quizzes WHERE code = ?"),
  majTitreQuiz: db.prepare("UPDATE quizzes SET title = ? WHERE code = ?"),
  supprimerQuiz: db.prepare("DELETE FROM quizzes WHERE code = ?"),

  // Questions.
  insererQuestion: db.prepare(`INSERT INTO questions
    (quiz_code, position, question, choices, correct_index, explanation, source_excerpt, source_page, origin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  lireQuestions: db.prepare("SELECT * FROM questions WHERE quiz_code = ? ORDER BY position ASC, id ASC"),
  lireQuestion: db.prepare("SELECT * FROM questions WHERE quiz_code = ? AND id = ?"),
  compterQuestions: db.prepare("SELECT COUNT(*) AS n FROM questions WHERE quiz_code = ?"),
  positionMax: db.prepare("SELECT COALESCE(MAX(position), 0) AS m FROM questions WHERE quiz_code = ?"),
  majQuestion: db.prepare(`UPDATE questions
    SET question = ?, choices = ?, correct_index = ?, explanation = ?
    WHERE quiz_code = ? AND id = ?`),
  supprimerQuestion: db.prepare("DELETE FROM questions WHERE quiz_code = ? AND id = ?"),

  // Flashcards.
  insererFlashcard: db.prepare(`INSERT INTO flashcards (quiz_code, front, back, source_page)
    VALUES (?, ?, ?, ?)`),
  lireFlashcards: db.prepare("SELECT id, front, back, source_page FROM flashcards WHERE quiz_code = ? ORDER BY id ASC"),

  // Tentatives + stats.
  insererTentative: db.prepare("INSERT INTO attempts (quiz_code, score, total, created_at) VALUES (?, ?, ?, ?)"),
  statsQuiz: db.prepare(`SELECT
      COUNT(*) AS attempts,
      AVG(100.0 * score / total) AS averageScore,
      MAX(100.0 * score / total) AS bestScore
    FROM attempts WHERE quiz_code = ?`),

  // Cours.
  insererCours: db.prepare(`INSERT INTO courses
    (code, title, text_hash, text_length, text, language, score, last_attempt_at, created_at, owner_key_hash)
    VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`),
  lireCours: db.prepare("SELECT * FROM courses WHERE code = ?"),
  lireCoursParHash: db.prepare("SELECT * FROM courses WHERE text_hash = ?"),
  majCours: db.prepare("UPDATE courses SET title = ?, text = ? WHERE code = ?"),
  majScoreCours: db.prepare("UPDATE courses SET score = ?, last_attempt_at = ? WHERE code = ?"),
  supprimerCours: db.prepare("DELETE FROM courses WHERE code = ?"),
  quizDuCours: db.prepare("SELECT code, title, difficulty, question_count, created_at FROM quizzes WHERE course_code = ? ORDER BY created_at DESC"),
  tentativesDuCours: db.prepare(`SELECT a.id, a.quiz_code, a.score, a.total, a.created_at
    FROM attempts a JOIN quizzes q ON q.code = a.quiz_code
    WHERE q.course_code = ? ORDER BY a.created_at ASC`),
};

/** Convertit une ligne SQL de question en objet API (choices en tableau). */
function questionVersApi(row) {
  return {
    id: row.id,
    position: row.position,
    question: row.question,
    choices: JSON.parse(row.choices),
    correct_index: row.correct_index,
    explanation: row.explanation,
    source_excerpt: row.source_excerpt, // null si ajoutée à la main
    source_page: row.source_page,
    origin: row.origin,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Codes uniques.
// ─────────────────────────────────────────────────────────────────────────

/** Génère un code de quiz garanti unique en base. @returns {string} */
export function nouveauCodeQuiz() {
  let code;
  do { code = genererCode(); } while (stmt.quizExiste.get(code));
  return code;
}

/** Génère un code de cours garanti unique en base. @returns {string} */
export function nouveauCodeCours() {
  let code;
  do { code = genererCode(); } while (stmt.coursExiste.get(code));
  return code;
}

// ─────────────────────────────────────────────────────────────────────────
// Quiz.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Crée un quiz complet (quiz + questions + flashcards) dans UNE transaction.
 * @param {object} q
 * @param {string} q.code
 * @param {string} q.title
 * @param {string} q.language
 * @param {string} q.difficulty
 * @param {number} q.questionCount
 * @param {number} q.sourceLength - Longueur du cours (le texte n'est jamais stocké ici).
 * @param {number} q.createdAt
 * @param {string} q.ownerKeyHash
 * @param {string|null} q.courseCode
 * @param {Array} q.questions - [{question, choices[], correct_index, explanation, source_excerpt?, source_page?, origin}]
 * @param {Array} q.flashcards - [{front, back, source_page}]
 * @returns {void}
 */
export function creerQuiz(q) {
  transaction(() => {
    stmt.insererQuiz.run(
      q.code, q.title, q.language, q.difficulty, q.questionCount,
      q.sourceLength, q.createdAt, q.ownerKeyHash, q.courseCode ?? null
    );
    q.questions.forEach((qu, i) => {
      stmt.insererQuestion.run(
        q.code, i + 1, qu.question, JSON.stringify(qu.choices),
        qu.correct_index, qu.explanation,
        qu.source_excerpt ?? null, qu.source_page ?? null,
        qu.origin === "manual" ? "manual" : "ai"
      );
    });
    for (const f of q.flashcards || []) {
      stmt.insererFlashcard.run(q.code, f.front, f.back, f.source_page ?? null);
    }
  });
}

/** @param {string} code @returns {boolean} */
export function quizExiste(code) {
  return !!stmt.quizExiste.get(code);
}

/** @param {string} code @returns {string|null} Hash propriétaire, ou null si quiz absent. */
export function ownerHashDuQuiz(code) {
  const row = stmt.ownerQuiz.get(code);
  return row ? row.owner_key_hash : null;
}

/**
 * Lit un quiz complet (métadonnées + questions + flashcards). Le hash
 * propriétaire n'est PAS exposé au client (le controller le retire).
 * @param {string} code
 * @returns {object|null}
 */
export function lireQuizComplet(code) {
  const quiz = stmt.lireQuiz.get(code);
  if (!quiz) return null;
  return {
    code: quiz.code,
    title: quiz.title,
    language: quiz.language,
    difficulty: quiz.difficulty,
    question_count: quiz.question_count,
    source_length: quiz.source_length,
    created_at: quiz.created_at,
    course_code: quiz.course_code,
    owner_key_hash: quiz.owner_key_hash, // le controller le retire avant envoi
    questions: stmt.lireQuestions.all(code).map(questionVersApi),
    flashcards: stmt.lireFlashcards.all(code),
  };
}

/** @param {string} code @param {string} title */
export function majTitreQuiz(code, title) {
  stmt.majTitreQuiz.run(title, code);
}

/** @param {string} code */
export function supprimerQuiz(code) {
  stmt.supprimerQuiz.run(code);
}

/** @param {string} code @returns {string|null} Code du cours rattaché, ou null. */
export function courseCodeDuQuiz(code) {
  const row = stmt.courseCodeDuQuiz.get(code);
  return row ? row.course_code : null;
}

// ─────────────────────────────────────────────────────────────────────────
// Questions.
// ─────────────────────────────────────────────────────────────────────────

/** @param {string} quizCode @returns {number} Nombre de questions du quiz. */
export function compterQuestions(quizCode) {
  return stmt.compterQuestions.get(quizCode).n;
}

/** @param {string} quizCode @param {number} id @returns {object|null} */
export function lireQuestion(quizCode, id) {
  const row = stmt.lireQuestion.get(quizCode, id);
  return row ? questionVersApi(row) : null;
}

/**
 * Ajoute une question à la fin du quiz (origin imposé par l'appelant).
 * @param {string} quizCode
 * @param {object} qu - {question, choices[], correct_index, explanation, origin}
 * @returns {object} La question créée (avec son id et sa position).
 */
export function ajouterQuestion(quizCode, qu) {
  const position = stmt.positionMax.get(quizCode).m + 1;
  const res = stmt.insererQuestion.run(
    quizCode, position, qu.question, JSON.stringify(qu.choices),
    qu.correct_index, qu.explanation,
    qu.source_excerpt ?? null, qu.source_page ?? null,
    qu.origin === "ai" ? "ai" : "manual"
  );
  return lireQuestion(quizCode, Number(res.lastInsertRowid));
}

/**
 * Met à jour une question (énoncé, propositions, bonne réponse, explication).
 * @param {string} quizCode @param {number} id
 * @param {object} qu - {question, choices[], correct_index, explanation}
 * @returns {object} La question mise à jour.
 */
export function majQuestion(quizCode, id, qu) {
  stmt.majQuestion.run(
    qu.question, JSON.stringify(qu.choices), qu.correct_index, qu.explanation,
    quizCode, id
  );
  return lireQuestion(quizCode, id);
}

/** @param {string} quizCode @param {number} id */
export function supprimerQuestion(quizCode, id) {
  stmt.supprimerQuestion.run(quizCode, id);
}

// ─────────────────────────────────────────────────────────────────────────
// Tentatives + stats.
// ─────────────────────────────────────────────────────────────────────────

/** @param {string} quizCode @param {number} score @param {number} total @param {number} createdAt */
export function ajouterTentative(quizCode, score, total, createdAt) {
  stmt.insererTentative.run(quizCode, score, total, createdAt);
}

/**
 * @param {string} quizCode
 * @returns {{attempts:number, averageScore:number|null, bestScore:number|null}}
 */
export function statsQuiz(quizCode) {
  const r = stmt.statsQuiz.get(quizCode);
  const round1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
  return {
    attempts: r.attempts,
    averageScore: round1(r.averageScore),
    bestScore: round1(r.bestScore),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Cours.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Crée un cours. @param {object} c
 * @returns {void}
 */
export function creerCours(c) {
  stmt.insererCours.run(
    c.code, c.title, c.textHash, c.textLength, c.text ?? null,
    c.language, c.createdAt, c.ownerKeyHash
  );
}

/** @param {string} textHash @returns {object|null} Cours reconnu par empreinte, ou null. */
export function lireCoursParHash(textHash) {
  return stmt.lireCoursParHash.get(textHash) || null;
}

/** @param {string} code @returns {object|null} */
export function lireCours(code) {
  return stmt.lireCours.get(code) || null;
}

/** @param {string} code @returns {string|null} */
export function ownerHashDuCours(code) {
  const row = stmt.ownerCours.get(code);
  return row ? row.owner_key_hash : null;
}

/** @param {string} code @returns {Array} Quiz rattachés (métadonnées). */
export function quizDuCours(code) {
  return stmt.quizDuCours.all(code);
}

/** @param {string} code @returns {Array} Tentatives de tous les quiz du cours. */
export function tentativesDuCours(code) {
  return stmt.tentativesDuCours.all(code);
}

/** @param {string} code @param {string} title @param {string|null} text */
export function majCours(code, title, text) {
  stmt.majCours.run(title, text ?? null, code);
}

/** @param {string} code @param {number} score @param {number} lastAttemptAt */
export function majScoreCours(code, score, lastAttemptAt) {
  stmt.majScoreCours.run(score, lastAttemptAt, code);
}

/** @param {string} code */
export function supprimerCours(code) {
  stmt.supprimerCours.run(code);
}
