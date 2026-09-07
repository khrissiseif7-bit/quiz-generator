/**
 * Validator.js — Validation CÔTÉ CLIENT du JSON reçu de /generate-quiz.
 *
 * COUCHE : Service (appelé uniquement par un Controller).
 * RÔLE : garantir que la réponse respecte le CONTRAT avant de la charger dans
 * QuizModel. C'est une défense de surface (le serveur valide déjà de façon
 * stricte dans validation.service.js) ; ici on rejette une réponse malformée
 * pour éviter de casser les Views.
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
   * Valide la structure complète d'une réponse quiz.
   * @param {unknown} data - JSON reçu du serveur.
   * @returns {{valid:boolean, errors:string[]}} Résultat et liste des erreurs.
   */
  validate(data) {
    // TODO: vérifier language ∈ {fr,ar,en}, title:string.
    // TODO: pour chaque question : type==="mcq", difficulty valide,
    //       choices.length===4 (chaînes), correct_index entier 0..3,
    //       source_page entier >= 1, champs texte présents.
    // TODO: pour chaque flashcard : id/front/back:string, source_page >= 1.
    // TODO: retourner { valid, errors }.
  }
}
