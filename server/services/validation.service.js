/**
 * validation.service.js — Validation STRICTE du quiz (le cœur du projet).
 *
 * COUCHE : Service (serveur).
 * RÔLE : garantir la qualité et l'HONNÊTETÉ du quiz produit par le LLM avant de
 * le renvoyer au client. Deux niveaux :
 *   1. schéma strict (ajv) conforme à /docs/contract.md ;
 *   2. vérifications sémantiques par question, dont l'ANCRAGE : chaque
 *      `source_excerpt` doit exister réellement dans le texte source.
 *
 * Les questions invalides sont ÉCARTÉES (jamais corrigées). La fonction renvoie
 * { valid: [...], rejected: [{ reason, question }] }. La décision de relancer la
 * génération (si trop peu de questions survivent) appartient au controller —
 * ce service reste PUR (pas d'appel réseau).
 *
 * ────────────────────────────────────────────────────────────────────────
 * CONTRAT (voir /docs/contract.md — source de vérité) :
 * {
 *   "language": "fr" | "ar" | "en",
 *   "title": string,
 *   "questions": [{
 *     "id": string, "type": "mcq", "difficulty": "easy"|"medium"|"hard",
 *     "question": string, "choices": [string x4], "correct_index": 0..3,
 *     "explanation": string, "source_excerpt": string, "source_page": number
 *   }],
 *   "flashcards": [{ "id": string, "front": string, "back": string, "source_page": number }]
 * }
 * ────────────────────────────────────────────────────────────────────────
 */

import Ajv from "ajv";

const ajv = new Ajv({ allErrors: true });

// Schéma strict d'UNE question (validé individuellement pour ne pas rejeter
// tout le lot à cause d'une seule question malformée).
const schemaQuestion = {
  type: "object",
  additionalProperties: false,
  required: ["id", "type", "difficulty", "question", "choices",
    "correct_index", "explanation", "source_excerpt", "source_page"],
  properties: {
    id: { type: "string", minLength: 1 },
    type: { const: "mcq" },
    difficulty: { enum: ["easy", "medium", "hard"] },
    question: { type: "string", minLength: 1 },
    choices: { type: "array", minItems: 4, maxItems: 4, items: { type: "string", minLength: 1 } },
    correct_index: { type: "integer", minimum: 0, maximum: 3 },
    explanation: { type: "string", minLength: 1 },
    source_excerpt: { type: "string", minLength: 1 },
    source_page: { type: "integer", minimum: 1 },
  },
};

// Schéma strict d'UNE flashcard.
const schemaFlashcard = {
  type: "object",
  additionalProperties: false,
  required: ["id", "front", "back", "source_page"],
  properties: {
    id: { type: "string", minLength: 1 },
    front: { type: "string", minLength: 1 },
    back: { type: "string", minLength: 1 },
    source_page: { type: "integer", minimum: 1 },
  },
};

const validerQuestion = ajv.compile(schemaQuestion);
const validerFlashcard = ajv.compile(schemaFlashcard);

// Longueur minimale exigée pour une explication utile.
const EXPLICATION_MIN = 40;

// Ratio minimal de mots retrouvés pour accepter un ancrage approximatif.
const SEUIL_ANCRAGE_FLOU = 0.85;

// Formulations interdites (fr / en / ar) pour les propositions.
const FORMULATIONS_INTERDITES = [
  "toutes les reponses", "toutes ces reponses", "aucune de ces reponses",
  "aucune reponse", "aucune des reponses",
  "all of the above", "none of the above", "both a and b",
  "كل ما سبق", "لا شيء مما سبق", "جميع ما سبق",
];

/**
 * Normalise un texte pour les comparaisons : minuscules, accents supprimés,
 * ponctuation retirée, espaces réduits.
 * @param {string} s - Chaîne à normaliser.
 * @returns {string} Chaîne normalisée.
 */
function normaliser(s) {
  return s
    .replace(/­/g, "")        // trait d'union conditionnel (soft hyphen)
    .replace(/-\s*\n\s*/g, "")      // césure : mot coupé en fin de ligne -> recollé
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")   // supprime les diacritiques latins
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // ponctuation -> espace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Vérifie qu'un extrait est ancré dans le texte source.
 * D'abord une inclusion exacte (après normalisation), sinon une correspondance
 * approximative : au moins 85 % des mots de l'extrait présents dans une même
 * fenêtre glissante du texte.
 * @param {string} extrait - source_excerpt à vérifier.
 * @param {string} texteNorm - Texte source déjà normalisé.
 * @param {string[]} motsTexte - Texte source déjà découpé en mots (normalisés).
 * @returns {boolean} true si l'extrait est considéré comme ancré.
 */
function extraitAncre(extrait, texteNorm, motsTexte) {
  const extraitNorm = normaliser(extrait);
  if (extraitNorm.length === 0) return false;

  // 1) Correspondance exacte (cas nominal attendu du prompt "mot pour mot").
  if (texteNorm.includes(extraitNorm)) return true;

  // 2) Correspondance approximative par fenêtre glissante.
  const motsExtrait = extraitNorm.split(" ");
  if (motsExtrait.length === 0) return false;

  const ensembleExtrait = new Set(motsExtrait);
  const taille = motsExtrait.length;
  let meilleurRatio = 0;

  for (let i = 0; i + taille <= motsTexte.length; i++) {
    const fenetre = new Set(motsTexte.slice(i, i + taille));
    let communs = 0;
    for (const mot of ensembleExtrait) {
      if (fenetre.has(mot)) communs++;
    }
    const ratio = communs / ensembleExtrait.size;
    if (ratio > meilleurRatio) meilleurRatio = ratio;
    if (meilleurRatio >= SEUIL_ANCRAGE_FLOU) return true;
  }
  return false;
}

/**
 * Applique les vérifications sémantiques à une question déjà valide au schéma.
 * @param {object} q - La question.
 * @param {string} texteNorm - Texte source normalisé.
 * @param {string[]} motsTexte - Mots du texte source.
 * @returns {string|null} Un motif de rejet, ou null si la question est acceptée.
 */
function verifierSemantique(q, texteNorm, motsTexte) {
  // Explication suffisamment étoffée.
  if (q.explanation.trim().length < EXPLICATION_MIN) {
    return "EXPLANATION_TOO_SHORT";
  }

  // Propositions toutes distinctes après normalisation.
  const normalisees = q.choices.map(normaliser);
  if (new Set(normalisees).size !== normalisees.length) {
    return "DUPLICATE_CHOICES";
  }

  // Aucune formulation du type "toutes/aucune des réponses".
  for (const choix of normalisees) {
    if (FORMULATIONS_INTERDITES.some((f) => choix.includes(f))) {
      return "FORBIDDEN_CHOICE";
    }
  }

  // Ancrage : l'extrait doit provenir du cours.
  if (!extraitAncre(q.source_excerpt, texteNorm, motsTexte)) {
    return "EXCERPT_NOT_FOUND";
  }

  return null;
}

/**
 * Valide un quiz produit par le LLM contre le contrat et le texte source.
 * @param {any} quiz - Objet quiz brut renvoyé par llm.service.
 * @param {string} sourceText - Texte source original (pour l'ancrage).
 * @returns {{valid:object[], rejected:{reason:string, question:object}[], flashcards:object[]}}
 */
export function validateQuiz(quiz, sourceText) {
  const valid = [];
  const rejected = [];

  const texteNorm = normaliser(sourceText);
  const motsTexte = texteNorm.split(" ");

  const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];
  for (const q of questions) {
    // 1) Schéma strict.
    if (!validerQuestion(q)) {
      rejected.push({ reason: "SCHEMA_INVALID", question: q });
      continue;
    }
    // 2) Sémantique + ancrage.
    const motif = verifierSemantique(q, texteNorm, motsTexte);
    if (motif) {
      rejected.push({ reason: motif, question: q });
    } else {
      valid.push(q);
    }
  }

  // Flashcards : on ne garde que celles conformes au schéma (pas d'ancrage exigé).
  const flashcards = (Array.isArray(quiz?.flashcards) ? quiz.flashcards : [])
    .filter((f) => validerFlashcard(f));

  return { valid, rejected, flashcards };
}

/**
 * [DEBUG] Localise, dans le texte source ORIGINAL, la fenêtre de mots qui
 * correspond le mieux à un extrait, et renvoie le contexte autour.
 * Utilisé uniquement pour le diagnostic (DEBUG_LLM) : n'intervient PAS dans la
 * validation. Permet de voir « à côté de quoi » le modèle a cité.
 * @param {string} extrait - source_excerpt renvoyé par le modèle.
 * @param {string} sourceText - Texte source original.
 * @param {number} [largeur=200] - Largeur approximative du contexte, en caractères.
 * @returns {{ratio:number, snippet:string}} Meilleur ratio de recouvrement (0..1) et extrait de contexte.
 */
export function contexteAncrage(extrait, sourceText, largeur = 200) {
  const motsExtrait = normaliser(extrait).split(" ").filter(Boolean);
  if (motsExtrait.length === 0) return { ratio: 0, snippet: "" };
  const ensembleExtrait = new Set(motsExtrait);

  // Tokenise le texte ORIGINAL en conservant la position de chaque mot.
  const tokens = [];
  const regex = /[\p{L}\p{N}]+/gu;
  let m;
  while ((m = regex.exec(sourceText)) !== null) {
    tokens.push({ norm: normaliser(m[0]), start: m.index, end: m.index + m[0].length });
  }
  if (tokens.length === 0) return { ratio: 0, snippet: "" };

  const taille = Math.min(motsExtrait.length, tokens.length);
  let meilleur = { ratio: 0, start: 0, end: Math.min(sourceText.length, largeur) };

  for (let i = 0; i + taille <= tokens.length; i++) {
    const fenetre = new Set();
    for (let j = i; j < i + taille; j++) fenetre.add(tokens[j].norm);
    let communs = 0;
    for (const mot of ensembleExtrait) if (fenetre.has(mot)) communs++;
    const ratio = communs / ensembleExtrait.size;
    if (ratio > meilleur.ratio) {
      meilleur = { ratio, start: tokens[i].start, end: tokens[i + taille - 1].end };
    }
  }

  // Contexte de ~largeur caractères centré sur la meilleure fenêtre.
  const milieu = Math.floor((meilleur.start + meilleur.end) / 2);
  const de = Math.max(0, milieu - Math.floor(largeur / 2));
  const a = Math.min(sourceText.length, de + largeur);
  return { ratio: meilleur.ratio, snippet: sourceText.slice(de, a) };
}
