/**
 * QuizApiClient.js — Client des routes REST de persistance (CRUD).
 *
 * COUCHE : Service (front). DISTINCT d'ApiClient.js (qui, lui, gère la
 * GÉNÉRATION via POST /generate-quiz). Ici : enregistrer/lire/modifier des quiz,
 * questions, tentatives et cours.
 *
 * Traitement des erreurs homogène : en cas de statut non 2xx, on lève une erreur
 * normalisée { httpStatus, backendCode, details } que les controllers mappent en
 * message clair (comme ApiClient). Les codes serveur : NOT_FOUND, FORBIDDEN,
 * VALIDATION_ERROR (+ details), CONFLICT, RATE_LIMITED.
 */
export class QuizApiClient {
  /**
   * @param {object} [options]
   * @param {string} [options.baseUrl=""] - Base des requêtes (même origine par défaut).
   */
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || "";
  }

  /**
   * Requête JSON générique avec une seconde tentative silencieuse sur erreur
   * réseau pure (pas sur 4xx/5xx qui sont des erreurs métier définitives).
   * @param {string} method
   * @param {string} chemin
   * @param {object} [opts]
   * @param {object} [opts.body] - Corps JSON.
   * @param {string} [opts.accessCode] - En-tête X-Access-Code.
   * @param {string} [opts.ownerKey] - En-tête X-Owner-Key.
   * @returns {Promise<any>} Corps JSON (ou null si 204).
   */
  async _request(method, chemin, opts = {}) {
    try {
      return await this._fetch(method, chemin, opts);
    } catch (err) {
      if (err.httpStatus === 0 && err.backendCode === "NETWORK") {
        await new Promise((r) => setTimeout(r, 1000));
        return await this._fetch(method, chemin, opts);
      }
      throw err;
    }
  }

  /** @private Une tentative d'appel réseau (utilisée par _request pour le retry). */
  async _fetch(method, chemin, { body, accessCode, ownerKey } = {}) {
    const enTetes = {};
    if (body !== undefined) enTetes["Content-Type"] = "application/json";
    if (accessCode) enTetes["X-Access-Code"] = accessCode;
    if (ownerKey) enTetes["X-Owner-Key"] = ownerKey;

    let reponse;
    try {
      reponse = await fetch(this.baseUrl + chemin, {
        method,
        headers: enTetes,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw erreur(0, "NETWORK");
    }

    if (reponse.status === 204) return null;

    let donnees = null;
    try { donnees = await reponse.json(); } catch { /* corps vide/illisible */ }

    if (!reponse.ok) {
      throw erreur(reponse.status, donnees?.error || "ERROR", donnees?.details);
    }
    return donnees;
  }

  // ── Quiz ────────────────────────────────────────────────────────────────
  saveQuiz(payload, accessCode, courseOwnerKey) {
    // courseOwnerKey : requis seulement si payload.course_code est renseigné
    // (le serveur exige la clé du COURS pour rattacher un quiz).
    return this._request("POST", "/quizzes", { body: payload, accessCode, ownerKey: courseOwnerKey });
  }
  getQuiz(code, accessCode) {
    return this._request("GET", `/quizzes/${code}`, { accessCode });
  }
  updateQuizTitle(code, title, accessCode, ownerKey) {
    return this._request("PUT", `/quizzes/${code}`, { body: { title }, accessCode, ownerKey });
  }
  deleteQuiz(code, accessCode, ownerKey) {
    return this._request("DELETE", `/quizzes/${code}`, { accessCode, ownerKey });
  }

  // ── Questions ────────────────────────────────────────────────────────────
  addQuestion(code, question, accessCode, ownerKey) {
    return this._request("POST", `/quizzes/${code}/questions`, { body: question, accessCode, ownerKey });
  }
  updateQuestion(code, id, question, accessCode, ownerKey) {
    return this._request("PUT", `/quizzes/${code}/questions/${id}`, { body: question, accessCode, ownerKey });
  }
  deleteQuestion(code, id, accessCode, ownerKey) {
    return this._request("DELETE", `/quizzes/${code}/questions/${id}`, { accessCode, ownerKey });
  }

  // ── Tentatives + stats ─────────────────────────────────────────────────
  addAttempt(code, score, total, accessCode) {
    return this._request("POST", `/quizzes/${code}/attempts`, { body: { score, total }, accessCode });
  }
  getStats(code, accessCode) {
    return this._request("GET", `/quizzes/${code}/stats`, { accessCode });
  }

  // ── Cours ────────────────────────────────────────────────────────────────
  createCourse(payload, accessCode) {
    return this._request("POST", "/courses", { body: payload, accessCode });
  }
  getCourse(code, accessCode, ownerKey) {
    return this._request("GET", `/courses/${code}`, { accessCode, ownerKey });
  }
  updateCourse(code, payload, accessCode, ownerKey) {
    return this._request("PUT", `/courses/${code}`, { body: payload, accessCode, ownerKey });
  }
  deleteCourse(code, accessCode, ownerKey) {
    return this._request("DELETE", `/courses/${code}`, { accessCode, ownerKey });
  }
}

/**
 * Construit une erreur normalisée.
 * @param {number} httpStatus
 * @param {string} backendCode
 * @param {Array} [details]
 * @returns {Error}
 */
function erreur(httpStatus, backendCode, details) {
  const err = new Error(backendCode);
  err.httpStatus = httpStatus;
  err.backendCode = backendCode;
  if (details) err.details = details;
  return err;
}
