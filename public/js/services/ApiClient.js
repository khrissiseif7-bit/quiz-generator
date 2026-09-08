/**
 * ApiClient.js — Client HTTP vers le backend.
 *
 * COUCHE : Service (appelé uniquement par un Controller).
 * RÔLE : appeler `POST /generate-quiz` selon le contrat (voir /docs/contract.md),
 * avec un timeout, et NORMALISER les erreurs pour que le Controller puisse
 * afficher un message clair par code :
 *   - err.httpStatus : statut HTTP (0 si réseau/timeout)
 *   - err.backendCode : code renvoyé par le serveur (ex. "TEXT_TOO_SHORT",
 *     "INVALID_CODE", "RATE_LIMITED", "GENERATION_FAILED"…) ou "TIMEOUT"/"NETWORK".
 * Ne valide PAS le schéma métier (rôle de Validator.js).
 */
export class ApiClient {
  /**
   * @param {object} [options]
   * @param {string} [options.baseUrl=""] - Base des requêtes (même origine par défaut).
   * @param {number} [options.timeoutMs=90000] - Délai max (le serveur peut faire
   *        deux tentatives LLM, on laisse une marge confortable).
   */
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || "";
    this.timeoutMs = options.timeoutMs || 90000;
  }

  /**
   * Envoie la demande de génération de quiz.
   * @param {{text:string, language:string, difficulty:string, questionCount:number}} payload
   * @param {string} accessCode - Code d'accès placé dans l'en-tête X-Access-Code.
   * @returns {Promise<object>} JSON de la réponse (à valider ensuite par Validator).
   * @throws {Error} Erreur normalisée (voir en-tête de fichier).
   */
  async generateQuiz(payload, accessCode) {
    const controleur = new AbortController();
    const minuteur = setTimeout(() => controleur.abort(), this.timeoutMs);

    const enTetes = { "Content-Type": "application/json" };
    if (accessCode) enTetes["X-Access-Code"] = accessCode;

    try {
      const reponse = await fetch(`${this.baseUrl}/generate-quiz`, {
        method: "POST",
        headers: enTetes,
        body: JSON.stringify(payload),
        signal: controleur.signal,
      });

      // Le serveur répond toujours en JSON ({...} ou { error, meta }).
      let donnees = null;
      try { donnees = await reponse.json(); } catch { donnees = null; }

      if (!reponse.ok) {
        throw normaliser(reponse.status, donnees && donnees.error, donnees && donnees.meta);
      }
      return donnees;
    } catch (err) {
      if (err.httpStatus != null) throw err;          // déjà normalisée
      if (err.name === "AbortError") throw normaliser(0, "TIMEOUT");
      throw normaliser(0, "NETWORK");                 // échec réseau / DNS / CORS
    } finally {
      clearTimeout(minuteur);
    }
  }
}

/**
 * Construit une erreur normalisée portant httpStatus + backendCode.
 * @param {number} httpStatus
 * @param {string} [backendCode]
 * @param {object} [meta]
 * @returns {Error}
 */
function normaliser(httpStatus, backendCode, meta) {
  const err = new Error(`API ${httpStatus} ${backendCode || ""}`.trim());
  err.httpStatus = httpStatus;
  err.backendCode = backendCode || null;
  if (meta) err.meta = meta;
  return err;
}
