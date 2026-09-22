/**
 * ApiClient.js — Client HTTP vers le backend.
 *
 * COUCHE : Service (appelé uniquement par un Controller).
 * RÔLE : appeler `POST /generate-quiz` selon le contrat (voir /docs/contract.md),
 * avec un timeout, et NORMALISER les erreurs pour que le Controller puisse
 * afficher un message clair par code :
 *   - err.httpStatus : statut HTTP (0 si réseau/timeout)
 *   - err.backendCode : code renvoyé par le serveur (ex. "TEXT_TOO_SHORT",
 *     "INVALID_CODE", "RATE_LIMITED", "GENERATION_FAILED"…) ou "TIMEOUT"/"NETWORK",
 *     ou "CANCELLED" en cas d'annulation VOLONTAIRE (err.cancelled === true).
 * Ne valide PAS le schéma métier (rôle de Validator.js).
 */
export class ApiClient {
  /**
   * @param {object} [options]
   * @param {string} [options.baseUrl=""] - Base des requêtes (même origine par défaut).
   * @param {number} [options.timeoutMs=130000] - Délai max. Doit dépasser le
   *        timeout serveur de callLLM (120 s) pour ne pas abandonner avant lui.
   */
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || "";
    this.timeoutMs = options.timeoutMs || 130000;
    /** @type {AbortController|null} Contrôleur de la requête en cours (pour cancel/timeout). */
    this._controleurCourant = null;
    this._cancelled = false;
  }

  /**
   * Envoie la demande de génération de quiz, avec une seconde tentative silencieuse
   * sur erreur réseau (pas sur 4xx/5xx qui sont des erreurs métier définitives).
   * @param {{text:string, language:string, difficulty:string, questionCount:number}} payload
   * @param {string} accessCode - Code d'accès placé dans l'en-tête X-Access-Code.
   * @returns {Promise<object>} JSON de la réponse (à valider ensuite par Validator).
   * @throws {Error} Erreur normalisée (voir en-tête de fichier).
   */
  async generateQuiz(payload, accessCode) {
    this._cancelled = false;
    try {
      return await this._attempt(payload, accessCode);
    } catch (err) {
      // Réessaie une fois sur erreur réseau pure (httpStatus 0, NETWORK).
      // Les erreurs 4xx/5xx et les timeouts ne sont jamais rejoués.
      if (err.httpStatus === 0 && err.backendCode === "NETWORK" && !err.cancelled && !this._cancelled) {
        await new Promise((r) => setTimeout(r, 1000));
        if (this._cancelled) throw erreurAnnulation();
        return await this._attempt(payload, accessCode);
      }
      throw err;
    }
  }

  /**
   * Une tentative d'appel réseau (utilisée par generateQuiz pour le retry).
   * @private
   */
  async _attempt(payload, accessCode) {
    const controleur = new AbortController();
    this._controleurCourant = controleur;
    // Le timeout avorte avec la raison "timeout" (à distinguer d'une annulation
    // volontaire, qui avorte avec la raison "cancel" via cancel()).
    const minuteur = setTimeout(() => controleur.abort("timeout"), this.timeoutMs);

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
        throw normaliser(reponse.status, donnees && donnees.error, donnees);
      }
      return donnees;
    } catch (err) {
      if (controleur.signal.aborted) {
        // Avortement : on distingue l'annulation volontaire du timeout via la raison.
        if (controleur.signal.reason === "cancel") throw erreurAnnulation();
        throw normaliser(0, "TIMEOUT");
      }
      if (err.httpStatus != null) throw err;          // déjà normalisée
      throw normaliser(0, "NETWORK");                 // échec réseau / DNS / CORS
    } finally {
      clearTimeout(minuteur);
      if (this._controleurCourant === controleur) this._controleurCourant = null;
    }
  }

  /**
   * Annule la requête en cours (et toute nouvelle tentative silencieuse) en
   * avortant l'AbortController courant avec la raison "cancel".
   * @returns {void}
   */
  cancel() {
    this._cancelled = true;
    if (this._controleurCourant) this._controleurCourant.abort("cancel");
  }
}

/**
 * Erreur d'ANNULATION VOLONTAIRE : le Controller doit la traiter en silence
 * (aucun message affiché), contrairement au timeout.
 * @returns {Error}
 */
function erreurAnnulation() {
  const err = new Error("Requête annulée");
  err.httpStatus = 0;
  err.backendCode = "CANCELLED";
  err.cancelled = true;
  return err;
}

/**
 * Construit une erreur normalisée portant httpStatus + backendCode, et remonte
 * `retryAfterSeconds` (quota 429) et `meta` s'ils sont présents dans la réponse.
 * @param {number} httpStatus
 * @param {string} [backendCode]
 * @param {object} [donnees] - Corps JSON de la réponse d'erreur.
 * @returns {Error}
 */
function normaliser(httpStatus, backendCode, donnees) {
  const err = new Error(`API ${httpStatus} ${backendCode || ""}`.trim());
  err.httpStatus = httpStatus;
  err.backendCode = backendCode || null;
  if (donnees && donnees.meta) err.meta = donnees.meta;
  if (donnees && donnees.retryAfterSeconds != null) err.retryAfterSeconds = donnees.retryAfterSeconds;
  return err;
}
