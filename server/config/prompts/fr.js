/**
 * fr.js — Gabarit de prompt en FRANÇAIS pour la génération de quiz.
 *
 * COUCHE : Config (serveur), consommé par llm.service.js.
 * RÈGLE : le prompt doit exiger du modèle une sortie STRICTEMENT conforme au
 * contrat (/docs/contract.md) : JSON unique, `type:"mcq"`, 4 `choices`,
 * `correct_index` 0..3, et chaque `source_excerpt` COPIÉ tel quel depuis le
 * texte source (anti-hallucination). Aucune logique ici : uniquement le texte.
 */

/**
 * Construit le prompt français.
 * @param {string} text - Texte source du cours.
 * @param {{difficulty:string, count:number}} options - Difficulté et nombre de questions.
 * @returns {string} Prompt complet à envoyer au provider.
 */
export default function frPrompt(text, options) {
  // TODO: retourner un prompt qui :
  //   - fixe le rôle (générateur de quiz pédagogique en français),
  //   - impose la langue "fr" dans la sortie,
  //   - demande `count` questions de type mcq à la difficulté `difficulty`,
  //   - rappelle le schéma JSON EXACT du contrat,
  //   - exige que source_excerpt provienne littéralement du texte,
  //   - insère `text` comme matière première.
}
