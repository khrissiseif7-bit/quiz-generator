/**
 * ApiClient.js — Client HTTP vers le backend.
 *
 * COUCHE : Service (appelé uniquement par un Controller).
 * RÔLE : appeler `POST /generate-quiz` selon le contrat (voir /docs/contract.md),
 * avec un timeout, et traduire les codes d'erreur HTTP en erreurs exploitables :
 *   - 401 : code d'accès manquant/invalide
 *   - 413 : contenu trop volumineux
 *   - 429 : quota dépassé
 *   - 502 : erreur provider LLM
 * Ne valide PAS le schéma métier (c'est le rôle de Validator.js).
 */
export class ApiClient {
  /**
   * @param {object} [options]
   * @param {string} [options.baseUrl] - Base des requêtes (par défaut même origine).
   * @param {number} [options.timeoutMs] - Délai max avant abandon de la requête.
   */
  constructor(options) {
    // TODO: mémoriser baseUrl et timeoutMs.
  }

  /**
   * Envoie la demande de génération de quiz.
   * @param {{text:string, language?:string, difficulty?:string, count?:number}} payload
   * @param {string} accessCode - Code d'accès placé dans l'en-tête X-Access-Code.
   * @returns {Promise<object>} JSON brut de la réponse (à valider ensuite par Validator).
   * @throws {Error} Erreur normalisée portant le code HTTP (401/413/429/502) ou timeout.
   */
  async generateQuiz(payload, accessCode) {
    // TODO: fetch POST /generate-quiz avec AbortController (timeout).
    // TODO: mapper les statuts 401/413/429/502 vers des erreurs typées.
    // TODO: retourner response.json() en cas de succès.
  }
}
