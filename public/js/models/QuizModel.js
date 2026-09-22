/**
 * QuizModel.js — État du quiz (édition, jeu, score, flashcards).
 *
 * COUCHE : Model. Ne touche JAMAIS au DOM ; notifie via l'EventBus.
 *
 * DEUX REPRÉSENTATIONS :
 *   - `editable` : les questions au format « source » (énoncé, 4 propositions
 *     dans l'ordre d'origine, correct_index, explication, extrait/page, origin).
 *     C'est ce que l'écran « Vérifier les questions » modifie (CRUD en mémoire) ;
 *   - `questions` : les questions PRÉPARÉES pour le jeu (propositions mélangées,
 *     réponse de l'utilisateur), construites à partir de `editable` au démarrage.
 *
 * ÉTAT D'ENREGISTREMENT : tant que `saved` est faux, le CRUD agit en mémoire ici
 * (validation incluse). Une fois enregistré (code + clé propriétaire), c'est le
 * controller qui passe par l'API, puis synchronise ce Model via `syncFromServer`.
 *
 * Événements publiés :
 *   "edit:changed"   { questions[], count, saved, code, isOwner }
 *   "quiz:question"  { question, index, total }
 *   "quiz:answered"  { choiceIndex, correctIndex, correct }
 *   "quiz:finished"  { score, total, percent, missed[] }
 *   "flashcard:card" / "flashcard:done"
 */

// Un quiz garde toujours au moins 3 questions (même règle que le serveur).
export const MIN_QUESTIONS = 3;

export class QuizModel {
  /** @param {import("../services/EventBus.js").EventBus} bus */
  constructor(bus) {
    this.bus = bus;

    // Métadonnées (pour l'enregistrement).
    this.title = "";
    this.language = "fr";
    this.difficulty = "medium";
    this.sourceLength = 0;
    this.courseCode = null;
    // Texte source gardé EN MÉMOIRE (jamais persisté par le Model) : sert au
    // rattachement à un cours lors de l'enregistrement (empreinte + option de
    // conservation). Perdu au rechargement de la page.
    this.sourceText = "";

    // Édition.
    this.editable = [];     // questions au format source (éditables)
    this._localSeq = 0;     // identifiants locaux stables avant enregistrement
    this.rejectedCount = null; // questions écartées à la génération (null hors génération)

    // Enregistrement.
    this.saved = false;
    this.code = null;
    this.ownerKey = null;

    // Jeu.
    this.questions = [];    // questions préparées (propositions mélangées)
    this.index = 0;
    this.isReplay = false;  // true si le run courant ne rejoue que les erreurs
    this.flashcards = [];
    this.deck = [];
  }

  /**
   * Charge un quiz généré (conforme au contrat) en MODE ÉDITION (non enregistré).
   * Ne démarre PAS le jeu : l'écran « Vérifier les questions » s'affiche d'abord.
   * @param {object} quiz - { title, language, difficulty?, source_length?, questions[], flashcards[] }
   * @returns {void}
   */
  load(quiz) {
    this.title = quiz.title;
    this.language = quiz.language;
    this.difficulty = quiz.difficulty || "medium";
    this.sourceLength = quiz.source_length || 0;
    this.courseCode = quiz.course_code || null;
    this.sourceText = quiz.source_text || "";
    this.flashcards = Array.isArray(quiz.flashcards) ? quiz.flashcards : [];
    // Nombre de questions écartées par la vérification d'ancrage (transparence :
    // affiché sur l'écran de révision). null = quiz non issu d'une génération.
    this.rejectedCount = quiz.meta ? (quiz.meta.rejectedCount ?? 0) : null;

    this.saved = false;
    this.code = null;
    this.ownerKey = null;
    this._localSeq = 0;

    this.editable = quiz.questions.map((q) => this._versEditable(q));
    this._emitEdit();
  }

  // ─────────────────────────── Édition (CRUD mémoire) ──────────────────────

  /** @returns {Array} Copie des questions éditables (pour la View). */
  getEditable() {
    return this.editable.map((q) => ({ ...q, choices: [...q.choices] }));
  }

  /**
   * Valide une question (mêmes règles que le serveur : 4 propositions distinctes
   * et non vides, correct_index 0..3, énoncé et explication non vides).
   * @param {object} q
   * @returns {{valid:boolean, errors:{field:string, code:string}[]}}
   */
  validate(q) {
    const errors = [];
    if (!estTexte(q.question)) errors.push({ field: "question", code: "REQUIRED" });
    if (!estTexte(q.explanation)) errors.push({ field: "explanation", code: "REQUIRED" });

    const choix = Array.isArray(q.choices) ? q.choices : [];
    if (choix.length !== 4 || choix.some((c) => !estTexte(c))) {
      errors.push({ field: "choices", code: "NOT_4_CHOICES" });
    } else {
      const norm = choix.map((c) => c.trim().toLowerCase());
      if (new Set(norm).size !== norm.length) errors.push({ field: "choices", code: "DUPLICATE_CHOICES" });
    }
    if (!Number.isInteger(q.correct_index) || q.correct_index < 0 || q.correct_index > 3) {
      errors.push({ field: "correct_index", code: "OUT_OF_RANGE" });
    }
    return { valid: errors.length === 0, errors };
  }

  /**
   * Ajoute une question À LA MAIN (origin 'manual', sans extrait source).
   * @param {object} data - { question, choices[4], correct_index, explanation }
   * @returns {{ok:boolean, errors?:Array}}
   */
  addQuestionLocal(data) {
    const v = this.validate(data);
    if (!v.valid) return { ok: false, errors: v.errors };
    this.editable.push({
      localId: ++this._localSeq,
      id: null,
      question: data.question.trim(),
      choices: data.choices.map((c) => c.trim()),
      correct_index: data.correct_index,
      explanation: data.explanation.trim(),
      source_excerpt: null,
      source_page: null,
      origin: "manual",
    });
    this._emitEdit();
    return { ok: true };
  }

  /**
   * Modifie une question existante (énoncé, propositions, bonne réponse, explication).
   * @param {number} localId
   * @param {object} data
   * @returns {{ok:boolean, errors?:Array}}
   */
  updateQuestionLocal(localId, data) {
    const v = this.validate(data);
    if (!v.valid) return { ok: false, errors: v.errors };
    const q = this.editable.find((e) => e.localId === localId);
    if (!q) return { ok: false, errors: [{ field: "question", code: "NOT_FOUND" }] };
    q.question = data.question.trim();
    q.choices = data.choices.map((c) => c.trim());
    q.correct_index = data.correct_index;
    q.explanation = data.explanation.trim();
    this._emitEdit();
    return { ok: true };
  }

  /**
   * Supprime une question. Refuse s'il ne resterait pas au moins 3 questions.
   * @param {number} localId
   * @returns {{ok:boolean, reason?:string}}
   */
  removeQuestionLocal(localId) {
    if (this.editable.length <= MIN_QUESTIONS) return { ok: false, reason: "MIN_QUESTIONS" };
    this.editable = this.editable.filter((e) => e.localId !== localId);
    this._emitEdit();
    return { ok: true };
  }

  /**
   * Ouvre un quiz EXISTANT récupéré par code (GET /quizzes/:code), en état
   * « enregistré ». Avec clé propriétaire -> éditable ; sans clé -> jouable seul.
   * @param {object} quiz - Quiz complet renvoyé par le serveur.
   * @param {string} code
   * @param {string|null} ownerKey
   */
  openExisting(quiz, code, ownerKey) {
    this.title = quiz.title;
    this.language = quiz.language;
    this.difficulty = quiz.difficulty || "medium";
    this.sourceLength = quiz.source_length || 0;
    this.courseCode = quiz.course_code || null;
    this.flashcards = Array.isArray(quiz.flashcards) ? quiz.flashcards : [];
    this.rejectedCount = null; // quiz existant : pas de résumé de génération
    this.saved = true;
    this.code = code;
    this.ownerKey = ownerKey || null;
    this._localSeq = 0;
    this.editable = quiz.questions.map((q) => this._versEditable(q));
    this._emitEdit();
  }

  /** Marque le quiz comme enregistré (après POST /quizzes). */
  markSaved(code, ownerKey) {
    this.saved = true;
    this.code = code;
    this.ownerKey = ownerKey;
    this._emitEdit();
  }

  /**
   * Synchronise l'état éditable avec un quiz renvoyé par le serveur (récupère les
   * ids réels des questions, dans l'ordre de position).
   * @param {object} serverQuiz - Quiz complet renvoyé par GET /quizzes/:code.
   */
  syncFromServer(serverQuiz) {
    this.editable = serverQuiz.questions.map((q) => ({
      localId: ++this._localSeq,
      id: q.id,
      question: q.question,
      choices: [...q.choices],
      correct_index: q.correct_index,
      explanation: q.explanation,
      source_excerpt: q.source_excerpt ?? null,
      source_page: q.source_page ?? null,
      origin: q.origin || "ai",
    }));
    this._emitEdit();
  }

  /** Corps prêt pour POST /quizzes (jamais le texte du cours, seulement sa longueur). */
  toSavePayload() {
    return {
      title: this.title,
      language: this.language,
      difficulty: this.difficulty,
      source_length: this.sourceLength,
      course_code: this.courseCode,
      questions: this.editable.map((q) => ({
        question: q.question,
        choices: q.choices,
        correct_index: q.correct_index,
        explanation: q.explanation,
        source_excerpt: q.source_excerpt,
        source_page: q.source_page,
        origin: q.origin,
      })),
      flashcards: this.flashcards.map((f) => ({ front: f.front, back: f.back, source_page: f.source_page ?? null })),
    };
  }

  // ─────────────────────────── Jeu ─────────────────────────────────────────

  /** Prépare les questions éditées pour le jeu (mélange) et démarre. */
  startPlay() {
    this.isReplay = false; // partie complète -> la tentative comptera
    this.questions = this.editable.map((e) => preparerQuestion(this._versContrat(e)));
    this.index = 0;
    this._emitQuestion();
  }

  answer(choiceIndex) {
    const q = this.questions[this.index];
    if (!q || q.chosen !== null) return;
    q.chosen = choiceIndex;
    this.bus.publish("quiz:answered", {
      choiceIndex,
      correctIndex: q.correctIndex,
      correct: choiceIndex === q.correctIndex,
    });
  }

  next() {
    if (this.index < this.questions.length - 1) {
      this.index += 1;
      this._emitQuestion();
    } else {
      this.bus.publish("quiz:finished", this.computeScore());
    }
  }

  computeScore() {
    let score = 0;
    const missed = [];
    for (const q of this.questions) {
      if (q.chosen === q.correctIndex) {
        score += 1;
      } else {
        missed.push({
          question: q.question,
          correctText: q.choices[q.correctIndex],
          chosenText: q.chosen !== null ? q.choices[q.chosen] : null,
          source_excerpt: q.source_excerpt,
          source_page: q.source_page,
        });
      }
    }
    const total = this.questions.length;
    const percent = total ? Math.round((score / total) * 100) : 0;
    return { score, total, percent, missed };
  }

  replayErrors() {
    const rates = this.questions.filter((q) => q.chosen !== q.correctIndex);
    if (rates.length === 0) return false;
    this.isReplay = true; // rejeu partiel -> on n'enregistre PAS de tentative
    this.questions = rates.map((q) => preparerQuestion(reconstituer(q)));
    this.index = 0;
    this._emitQuestion();
    return true;
  }

  // ---- Flashcards ----
  startFlashcards() {
    this.deck = [...this.flashcards];
    this._emitFlashcard();
  }
  markFlashcard(known) {
    if (this.deck.length === 0) return;
    const carte = this.deck.shift();
    if (!known) this.deck.push(carte);
    this._emitFlashcard();
  }

  // ---- Interne ----
  _emitEdit() {
    this.bus.publish("edit:changed", {
      questions: this.getEditable(),
      count: this.editable.length,
      rejectedCount: this.rejectedCount, // pour le résumé de génération
      saved: this.saved,
      code: this.code,
      isOwner: this.saved && !!this.ownerKey, // éditable seulement avec la clé
    });
  }

  _emitQuestion() {
    const q = this.questions[this.index];
    this.bus.publish("quiz:question", {
      question: {
        question: q.question,
        choices: q.choices,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        source_excerpt: q.source_excerpt,
        source_page: q.source_page,
      },
      index: this.index,
      total: this.questions.length,
    });
  }

  _emitFlashcard() {
    if (this.deck.length === 0) { this.bus.publish("flashcard:done", {}); return; }
    const carte = this.deck[0];
    this.bus.publish("flashcard:card", {
      front: carte.front, back: carte.back,
      remaining: this.deck.length, total: this.flashcards.length,
    });
  }

  /** Question générée/serveur -> format éditable (avec id local stable). */
  _versEditable(q) {
    return {
      localId: ++this._localSeq,
      id: typeof q.id === "number" ? q.id : null, // id string du LLM -> pas un id serveur
      question: q.question,
      choices: [...q.choices],
      correct_index: q.correct_index,
      explanation: q.explanation,
      source_excerpt: q.source_excerpt ?? null,
      source_page: q.source_page ?? null,
      origin: q.origin === "manual" ? "manual" : "ai",
    };
  }

  /** Question éditable -> format contrat (pour préparer le jeu). */
  _versContrat(e) {
    return {
      id: e.id,
      question: e.question,
      choices: e.choices,
      correct_index: e.correct_index,
      explanation: e.explanation,
      source_excerpt: e.source_excerpt,
      source_page: e.source_page,
    };
  }
}

/** Vrai si `s` est une chaîne non vide (après trim). */
function estTexte(s) {
  return typeof s === "string" && s.trim().length > 0;
}

/** Mélange en place (Fisher-Yates). */
function melangerFisherYates(t) {
  for (let i = t.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [t[i], t[j]] = [t[j], t[i]];
  }
  return t;
}

/** Prépare une question : propositions mélangées + index de bonne réponse recalculé. */
function preparerQuestion(q) {
  const ordre = melangerFisherYates([0, 1, 2, 3]);
  const choices = ordre.map((k) => q.choices[k]);
  const correctIndex = ordre.indexOf(q.correct_index);
  return {
    id: q.id,
    question: q.question,
    choices,
    correctIndex,
    explanation: q.explanation,
    source_excerpt: q.source_excerpt,
    source_page: q.source_page,
    chosen: null,
  };
}

/** Question préparée -> format contrat (pour re-mélanger au « rejouer les erreurs »). */
function reconstituer(prep) {
  return {
    id: prep.id,
    question: prep.question,
    choices: prep.choices,
    correct_index: prep.correctIndex,
    explanation: prep.explanation,
    source_excerpt: prep.source_excerpt,
    source_page: prep.source_page,
  };
}
