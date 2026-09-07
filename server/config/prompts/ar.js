/**
 * ar.js — Gabarit de prompt en ARABE pour la génération de quiz.
 *
 * COUCHE : Config (serveur), consommé par llm.service.js.
 * RÈGLE : sortie STRICTEMENT conforme au contrat (/docs/contract.md) avec
 * `language:"ar"`. Chaque `source_excerpt` doit être copié littéralement depuis
 * le texte source (anti-hallucination). Aucune logique ici : uniquement le texte.
 */

/**
 * Construit le prompt arabe.
 * @param {string} text - Texte source du cours.
 * @param {{difficulty:string, count:number}} options - Difficulté et nombre de questions.
 * @returns {string} Prompt complet à envoyer au provider.
 */
export default function arPrompt(text, options) {
  // TODO: retourner un prompt (rédigé en arabe) qui :
  //   - fixe le rôle (générateur de quiz pédagogique en arabe),
  //   - impose la langue "ar" dans la sortie,
  //   - demande `count` questions de type mcq à la difficulté `difficulty`,
  //   - rappelle le schéma JSON EXACT du contrat,
  //   - exige que source_excerpt provienne littéralement du texte,
  //   - insère `text` comme matière première.
}
