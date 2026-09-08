/**
 * QuizModel.js — État du quiz en cours (questions, réponses, score, flashcards).
 *
 * COUCHE : Model. Ne touche JAMAIS au DOM ; notifie via l'EventBus.
 * RESPONSABILITÉ (logique métier) :
 *   - mélanger les propositions (Fisher-Yates) en suivant l'index de la bonne
 *     réponse (recalcul de correctIndex après mélange) ;
 *   - mémoriser la réponse de l'utilisateur, calculer le SCORE ;
 *   - gérer le paquet de flashcards (les « à revoir » repassent à la fin).
 * Les Views ne font que rendre les données publiées ici.
 *
 * Événements publiés :
 *   "quiz:question"  { question, index, total }
 *   "quiz:answered"  { choiceIndex, correctIndex, correct }
 *   "quiz:finished"  { score, total, percent, missed[] }
 *   "flashcard:card" { front, back, remaining, total }
 *   "flashcard:done"
 */
export class QuizModel {
  /**
   * @param {import("../services/EventBus.js").EventBus} bus
   */
  constructor(bus) {
    this.bus = bus;
    this.title = "";
    this.language = "fr";
    this.questions = [];   // questions préparées (propositions mélangées)
    this.index = 0;
    this.flashcards = [];   // paquet source (immuable)
    this.deck = [];         // file de révision courante
  }

  /**
   * Charge un quiz validé (conforme au contrat) et démarre la première question.
   * @param {{title:string, language:string, questions:Array, flashcards:Array}} quiz
   * @returns {void}
   */
  load(quiz) {
    this.title = quiz.title;
    this.language = quiz.language;
    this.flashcards = Array.isArray(quiz.flashcards) ? quiz.flashcards : [];
    this.questions = quiz.questions.map((q) => preparerQuestion(q));
    this.index = 0;
    this._emitQuestion();
  }

  /**
   * Enregistre la réponse à la question courante (une seule fois : verrou).
   * @param {number} choiceIndex - Index (0..3) du choix sélectionné.
   * @returns {void}
   */
  answer(choiceIndex) {
    const q = this.questions[this.index];
    if (!q || q.chosen !== null) return; // déjà répondu -> verrouillé
    q.chosen = choiceIndex;
    this.bus.publish("quiz:answered", {
      choiceIndex,
      correctIndex: q.correctIndex,
      correct: choiceIndex === q.correctIndex,
    });
  }

  /**
   * Passe à la question suivante, ou termine le quiz.
   * @returns {void}
   */
  next() {
    if (this.index < this.questions.length - 1) {
      this.index += 1;
      this._emitQuestion();
    } else {
      this.bus.publish("quiz:finished", this.computeScore());
    }
  }

  /**
   * Calcule le score et la liste des questions ratées — LOGIQUE MÉTIER.
   * @returns {{score:number, total:number, percent:number, missed:Array}}
   */
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
        });
      }
    }
    const total = this.questions.length;
    const percent = total ? Math.round((score / total) * 100) : 0;
    return { score, total, percent, missed };
  }

  /**
   * Reconstruit un quiz composé uniquement des questions ratées et le redémarre.
   * @returns {boolean} true si des erreurs existaient (quiz rejoué), false sinon.
   */
  replayErrors() {
    const rates = this.questions.filter((q) => q.chosen !== q.correctIndex);
    if (rates.length === 0) return false;
    // On repart de zéro sur ces questions (réponses effacées, propositions re-mélangées).
    this.questions = rates.map((q) => preparerQuestion(reconstituer(q)));
    this.index = 0;
    this._emitQuestion();
    return true;
  }

  // ---- Flashcards ----

  /**
   * Démarre la révision : copie le paquet et affiche la première carte.
   * @returns {void}
   */
  startFlashcards() {
    this.deck = [...this.flashcards];
    this._emitFlashcard();
  }

  /**
   * Marque la carte courante ; si « à revoir », elle repart à la fin du paquet.
   * @param {boolean} known - true = « je savais », false = « à revoir ».
   * @returns {void}
   */
  markFlashcard(known) {
    if (this.deck.length === 0) return;
    const carte = this.deck.shift();
    if (!known) this.deck.push(carte);
    this._emitFlashcard();
  }

  // ---- Interne ----

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
    if (this.deck.length === 0) {
      this.bus.publish("flashcard:done", {});
      return;
    }
    const carte = this.deck[0];
    this.bus.publish("flashcard:card", {
      front: carte.front,
      back: carte.back,
      remaining: this.deck.length,
      total: this.flashcards.length,
    });
  }
}

/**
 * Mélange en place un tableau (Fisher-Yates).
 * @param {number[]} tableau
 * @returns {number[]}
 */
function melangerFisherYates(tableau) {
  for (let i = tableau.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tableau[i], tableau[j]] = [tableau[j], tableau[i]];
  }
  return tableau;
}

/**
 * Prépare une question : mélange les 4 propositions et recalcule l'index de la
 * bonne réponse dans le nouvel ordre.
 * @param {object} q - Question au format contrat.
 * @returns {object} Question préparée (avec correctIndex mélangé, chosen=null).
 */
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

/**
 * Reconstitue une question au format contrat à partir d'une question préparée,
 * pour pouvoir la re-mélanger lors du « rejouer les erreurs ».
 * @param {object} prep - Question préparée.
 * @returns {object} Question au format contrat.
 */
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
