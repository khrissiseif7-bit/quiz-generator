/**
 * llm.service.js — Construction du prompt + appel au provider LLM.
 *
 * COUCHE : Service (serveur).
 * RÈGLE : le provider (OpenAI, Anthropic, ...) est ISOLÉ derrière une interface
 * pour pouvoir en changer sans toucher au controller. Le service :
 *   1. choisit le gabarit de prompt selon la langue (config/prompts/{fr,ar,en}.js),
 *   2. appelle le provider via l'interface `LlmProvider`,
 *   3. renvoie le JSON quiz brut (validé ensuite par validation.service.js).
 *
 * En cas d'échec provider ou de sortie non-JSON, lève une erreur -> 502.
 */

// TODO: import des gabarits : import fr from "../config/prompts/fr.js"; (ar, en)

/**
 * @typedef {Object} LlmProvider
 * @property {(prompt:string) => Promise<string>} complete - Appel brut au modèle,
 *           renvoie la complétion texte (censée contenir le JSON du quiz).
 */

/**
 * Fabrique un provider selon la configuration d'environnement.
 * @param {object} env - Variables d'environnement (LLM_PROVIDER, LLM_API_KEY, LLM_MODEL).
 * @returns {LlmProvider} Implémentation concrète respectant l'interface.
 */
export function createProvider(env) {
  // TODO: selon env.LLM_PROVIDER, retourner une implémentation { complete }.
  //       L'appel réseau réel appartient à l'implémentation concrète.
}

/**
 * Construit le prompt final à partir du texte source et des réglages.
 * @param {string} text - Texte source du cours.
 * @param {{language:string, difficulty:string, count:number}} options
 * @returns {string} Prompt prêt à être envoyé au provider.
 */
function buildPrompt(text, options) {
  // TODO: sélectionner le gabarit selon options.language, y injecter text/difficulty/count.
}

/**
 * Génère un quiz brut via le LLM.
 * @param {string} text - Texte source.
 * @param {{language:string, difficulty:string, count:number}} options
 * @param {LlmProvider} [provider] - Provider injecté (sinon créé depuis l'env).
 * @returns {Promise<object>} Objet quiz brut (au format contrat, non encore validé).
 * @throws {Error} Erreur -> 502 si le provider échoue ou renvoie un JSON illisible.
 */
export async function generateQuiz(text, options, provider) {
  // TODO: prompt = buildPrompt(text, options).
  // TODO: raw = await provider.complete(prompt).
  // TODO: parser le JSON du modèle, retourner l'objet quiz.
}
