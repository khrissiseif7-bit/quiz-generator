/**
 * Validator.js — Validation CÔTÉ CLIENT du JSON reçu de /generate-quiz.
 *
 * COUCHE : Service (appelé uniquement par un Controller).
 * RÔLE : défense de surface avant de charger la réponse dans QuizModel. Le
 * serveur valide déjà strictement (validation.service.js) ; ici on rejette une
 * réponse malformée pour éviter de casser les Views.
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
export class Validator {
  /**
   * Valide la structure d'une réponse quiz.
   * @param {unknown} data
   * @returns {{valid:boolean, errors:string[]}}
   */
  validate(data) {
    const errors = [];
    const estTexte = (v) => typeof v === "string" && v.trim().length > 0;

    if (!data || typeof data !== "object") {
      return { valid: false, errors: ["réponse non-objet"] };
    }
    if (!["fr", "ar", "en"].includes(data.language)) errors.push("language invalide");
    if (!estTexte(data.title)) errors.push("title manquant");

    if (!Array.isArray(data.questions) || data.questions.length === 0) {
      errors.push("questions manquantes");
    } else {
      data.questions.forEach((q, i) => {
        if (!estTexte(q.question)) errors.push(`q${i}: énoncé`);
        if (!Array.isArray(q.choices) || q.choices.length !== 4 || !q.choices.every(estTexte)) {
          errors.push(`q${i}: 4 propositions requises`);
        }
        if (!Number.isInteger(q.correct_index) || q.correct_index < 0 || q.correct_index > 3) {
          errors.push(`q${i}: correct_index`);
        }
        if (!estTexte(q.explanation)) errors.push(`q${i}: explication`);
        if (!estTexte(q.source_excerpt)) errors.push(`q${i}: extrait source`);
      });
    }

    // Les flashcards sont optionnelles pour l'affichage : on tolère une liste vide.
    if (data.flashcards && !Array.isArray(data.flashcards)) errors.push("flashcards invalides");

    return { valid: errors.length === 0, errors };
  }
}
