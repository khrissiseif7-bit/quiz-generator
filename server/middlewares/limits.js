/**
 * limits.js — Middleware de validation des entrées et des limites de taille.
 *
 * COUCHE : Middleware (serveur).
 * RÔLE : rejeter tôt (avant tout appel LLM coûteux) les requêtes mal formées :
 *   - texte trop court (< 300 caractères)      -> 400 TEXT_TOO_SHORT
 *   - texte trop long  (> MAX_TEXT_LENGTH)     -> 413 TEXT_TOO_LONG
 *   - language  hors {auto, fr, ar, en}        -> 400 INVALID_LANGUAGE
 *   - difficulty hors {easy, medium, hard}     -> 400 INVALID_DIFFICULTY
 *   - questionCount hors {5, 10, 15}           -> 400 INVALID_QUESTION_COUNT
 *
 * La taille brute du corps (250 ko) est déjà bornée par express.json dans
 * server.js ; ici on contrôle la longueur MÉTIER du champ `text`.
 */

// Valeurs autorisées, centralisées pour rester lisibles.
const LANGUES_OK = ["auto", "fr", "ar", "en"];
const DIFFICULTES_OK = ["easy", "medium", "hard"];
const NB_QUESTIONS_OK = [5, 10, 15];

// Longueur minimale d'un cours exploitable (en caractères).
const MIN_TEXT_LENGTH = 300;

/**
 * Middleware Express de contrôle des entrées.
 * @param {import("express").Request} req - Requête ({ body:{ text, language, difficulty, questionCount } }).
 * @param {import("express").Response} res - Réponse ; renvoie l'erreur adaptée si invalide.
 * @param {import("express").NextFunction} next - Middleware suivant si tout est valide.
 * @returns {void}
 */
export function enforceLimits(req, res, next) {
  const maxTextLength = Number(process.env.MAX_TEXT_LENGTH) || 50000;
  const { text, language, difficulty, questionCount } = req.body || {};

  // --- Texte source ---
  if (typeof text !== "string" || text.trim().length < MIN_TEXT_LENGTH) {
    return res.status(400).json({ error: "TEXT_TOO_SHORT" });
  }
  if (text.length > maxTextLength) {
    return res.status(413).json({ error: "TEXT_TOO_LONG" });
  }

  // --- Paramètres de génération ---
  if (!LANGUES_OK.includes(language)) {
    return res.status(400).json({ error: "INVALID_LANGUAGE" });
  }
  if (!DIFFICULTES_OK.includes(difficulty)) {
    return res.status(400).json({ error: "INVALID_DIFFICULTY" });
  }
  // questionCount peut arriver en nombre ou en chaîne selon le client : on normalise.
  if (!NB_QUESTIONS_OK.includes(Number(questionCount))) {
    return res.status(400).json({ error: "INVALID_QUESTION_COUNT" });
  }

  return next();
}
