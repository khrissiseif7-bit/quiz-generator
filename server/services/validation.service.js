/**
 * validation.service.js — Validation STRICTE du quiz côté serveur.
 *
 * COUCHE : Service (serveur).
 * RÔLE : garantir que la sortie du LLM respecte le contrat AVANT de la renvoyer
 * au client, et surtout vérifier que chaque `source_excerpt` EXISTE réellement
 * dans le texte source (garde-fou anti-hallucination). Une réponse non conforme
 * doit provoquer un 502 côté controller.
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

/**
 * Valide un quiz produit par le LLM contre le contrat et le texte source.
 * @param {unknown} quiz - Objet quiz brut renvoyé par llm.service.
 * @param {string} sourceText - Texte source original (pour vérifier les extraits).
 * @returns {{valid:boolean, errors:string[]}} Résultat et liste des erreurs.
 */
export function validateQuiz(quiz, sourceText) {
  // TODO: vérifier language ∈ {fr,ar,en} et title:string.
  // TODO: pour chaque question : type==="mcq", difficulty valide,
  //       choices.length===4 (chaînes non vides), correct_index entier 0..3,
  //       source_page entier >= 1, champs texte présents.
  // TODO: ANTI-HALLUCINATION : vérifier que source_excerpt est réellement inclus
  //       dans sourceText (après normalisation raisonnable des espaces).
  // TODO: pour chaque flashcard : id/front/back:string, source_page >= 1.
  // TODO: retourner { valid, errors }.
}
