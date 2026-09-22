-- schema.sql — Schéma de la base SQLite (persistance des quiz et des cours).
--
-- PRINCIPE DIRECTEUR : on stocke le QUIZ, jamais le texte du cours.
-- Le texte source n'est conservé QUE si l'utilisateur coche explicitement
-- « conserver le texte » (colonne courses.text, NULL par défaut). Les quiz et
-- les questions ne contiennent aucun texte de cours, seulement sa longueur
-- (source_length) et l'extrait cité (source_excerpt) validé par ancrage.
--
-- Appliqué au démarrage avec CREATE TABLE IF NOT EXISTS (voir db/connection.js).
-- PRAGMA foreign_keys = ON est posé côté connexion (obligatoire à chaque
-- ouverture SQLite pour activer réellement les clés étrangères et les cascades).
--
-- Horodatages : entiers = millisecondes epoch (Date.now()). Faciles à comparer
-- pour la courbe de l'oubli (score.service.js).

-- ─────────────────────────────────────────────────────────────────────────
-- COURS : regroupe les quiz d'un même document et porte le score de révision.
-- Le texte (text) n'est présent que si l'utilisateur a choisi de le conserver.
-- text_hash = empreinte du texte NORMALISÉ (voir security.service.js) : permet
-- de reconnaître un même document re-déposé (unicité).
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
  code            TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  text_hash       TEXT UNIQUE,
  text_length     INTEGER NOT NULL,
  text            TEXT,                 -- NULL sauf si « conserver le texte »
  language        TEXT NOT NULL,
  score           REAL DEFAULT NULL,    -- score de révision stocké (0..100)
  last_attempt_at INTEGER,              -- ms epoch de la dernière tentative
  created_at      INTEGER NOT NULL,
  owner_key_hash  TEXT NOT NULL         -- SHA-256 de la clé propriétaire
);

-- ─────────────────────────────────────────────────────────────────────────
-- QUIZ : métadonnées + rattachement facultatif à un cours. Ne stocke PAS le
-- texte du cours (uniquement sa longueur : source_length).
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quizzes (
  code           TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  language       TEXT NOT NULL,
  difficulty     TEXT NOT NULL,
  question_count INTEGER NOT NULL,
  source_length  INTEGER NOT NULL,      -- longueur du cours, jamais le texte
  created_at     INTEGER NOT NULL,
  owner_key_hash TEXT NOT NULL,
  course_code    TEXT DEFAULT NULL      -- un quiz peut exister sans cours
    REFERENCES courses(code) ON DELETE CASCADE
);

-- ─────────────────────────────────────────────────────────────────────────
-- QUESTIONS : les choix sont stockés en JSON (tableau de 4 chaînes).
-- origin = 'ai' (générée) ou 'manual' (ajoutée à la main : pas de source_excerpt).
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS questions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_code      TEXT NOT NULL REFERENCES quizzes(code) ON DELETE CASCADE,
  position       INTEGER NOT NULL,
  question       TEXT NOT NULL,
  choices        TEXT NOT NULL,         -- JSON : ["a","b","c","d"]
  correct_index  INTEGER NOT NULL,
  explanation    TEXT NOT NULL,
  source_excerpt TEXT,                  -- NULL si question ajoutée à la main
  source_page    INTEGER,
  origin         TEXT NOT NULL CHECK (origin IN ('ai', 'manual'))
);

-- ─────────────────────────────────────────────────────────────────────────
-- FLASHCARDS : recto/verso liés au quiz.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flashcards (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_code   TEXT NOT NULL REFERENCES quizzes(code) ON DELETE CASCADE,
  front       TEXT NOT NULL,
  back        TEXT NOT NULL,
  source_page INTEGER
);

-- ─────────────────────────────────────────────────────────────────────────
-- TENTATIVES : un score par passage du quiz. Alimente les stats et le score
-- du cours rattaché.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attempts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_code  TEXT NOT NULL REFERENCES quizzes(code) ON DELETE CASCADE,
  score      INTEGER NOT NULL,
  total      INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- Index pour les lectures fréquentes (tri par position, filtrage par clé étrangère).
CREATE INDEX IF NOT EXISTS idx_questions_quiz  ON questions (quiz_code, position);
CREATE INDEX IF NOT EXISTS idx_flashcards_quiz ON flashcards (quiz_code);
CREATE INDEX IF NOT EXISTS idx_attempts_quiz   ON attempts (quiz_code, created_at);
CREATE INDEX IF NOT EXISTS idx_quizzes_course  ON quizzes (course_code);
