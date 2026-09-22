/**
 * UploadController.js — Orchestration de l'écran d'import et de la génération.
 *
 * COUCHE : Controller. SEUL habilité à appeler les Services (ApiClient,
 * Validator, LanguageDetector, I18n). Écoute les intentions UI, met à jour les
 * Models, pilote les transitions d'écran et la gestion d'erreurs par code.
 * Ne manipule PAS le DOM directement.
 */
export class UploadController {
  /**
   * @param {object} deps
   * @param {import("../services/EventBus.js").EventBus} deps.bus
   * @param {import("../models/DocumentModel.js").DocumentModel} deps.documentModel
   * @param {import("../models/SettingsModel.js").SettingsModel} deps.settingsModel
   * @param {import("../models/QuizModel.js").QuizModel} deps.quizModel
   * @param {import("../services/ApiClient.js").ApiClient} deps.apiClient
   * @param {import("../services/Validator.js").Validator} deps.validator
   * @param {import("../services/LanguageDetector.js").LanguageDetector} deps.languageDetector
   * @param {import("../services/I18n.js").I18n} deps.i18n
   */
  constructor(deps) {
    Object.assign(this, deps);

    // Jeton identifiant la génération en cours. Incrémenté à chaque génération
    // et à chaque annulation : sert à ignorer une réponse tardive après annulation.
    this._genId = 0;

    this.bus.subscribe("ui:text-changed", ({ text }) => {
      this.documentModel.setText(text);
      // Recommandation instantanée du nombre de questions (heuristique client).
      this.bus.publish("app:recommendation", { count: this.settingsModel.recommendCount(text) });
    });

    this.bus.subscribe("ui:settings-changed", ({ count, difficulty, language }) => {
      this.settingsModel.setCount(count);
      this.settingsModel.setDifficulty(difficulty);
      this.settingsModel.setLanguage(language);
      // Un choix de langue explicite bascule aussi l'interface (et le sens RTL).
      if (language !== "auto") {
        this.i18n.setLanguage(language);
        // Re-publier l'état du texte pour re-traduire compteur/indice.
        this.documentModel.setText(this.documentModel.getText());
      }
    });

    this.bus.subscribe("ui:access-code-changed", ({ code }) => {
      this.settingsModel.setAccessCode(code);
    });

    this.bus.subscribe("ui:generate", () => this.handleGenerate());
    this.bus.subscribe("ui:pdf-selected", ({ file }) => this.handlePdf(file));
    this.bus.subscribe("ui:reset", () => this.handleReset());
    this.bus.subscribe("ui:cancel", () => this.handleCancel());
    this.bus.subscribe("ui:home-reset", () => this.handleHomeReset());

    // Options « cours » (cases à cocher) -> Model.
    this.bus.subscribe("ui:course-options-changed", ({ attach, storeText }) => {
      this.settingsModel.setAttachToCourses(attach);
      this.settingsModel.setStoreCourseText(storeText);
    });
    // Ouverture d'un quiz existant par code.
    this.bus.subscribe("ui:open-quiz", (e) => this.handleOpenQuiz(e));
  }

  /**
   * Ouvre un quiz existant par code : sans clé -> jeu direct ; avec clé -> édition.
   * @param {{code:string, ownerKey:string}} e
   * @returns {Promise<void>}
   */
  async handleOpenQuiz({ code, ownerKey }) {
    const c = (code || "").trim().toUpperCase();
    const key = (ownerKey || "").trim();
    if (c.length !== 6) {
      return this.bus.publish("open:error", { message: this.i18n.t("err_open_code") });
    }
    try {
      const full = await this.quizApiClient.getQuiz(c, this.settingsModel.getAccessCode());
      this.i18n.setLanguage(full.language);
      this.quizModel.openExisting(full, c, key || null);
      if (key) {
        this.bus.publish("screen:show", { name: "edit" }); // openExisting a déjà émis edit:changed
      } else {
        this.bus.publish("screen:show", { name: "quiz" });
        this.quizModel.startPlay();
      }
    } catch (err) {
      const msg = err.httpStatus === 404 ? this.i18n.t("err_open_notfound")
        : err.httpStatus === 401 ? this.i18n.t("err_401")
        : err.httpStatus === 0 ? this.i18n.t("err_network")
        : this.i18n.t("err_generic");
      this.bus.publish("open:error", { message: msg });
    }
  }

  /**
   * Réinitialise l'écran d'upload à l'état du premier chargement : texte, PDF,
   * réglages (difficulté, langue, nombre de questions), cases à cocher, code
   * d'accès. Appelé par le bouton « Réinitialiser » et par handleHomeReset().
   * @returns {void}
   */
  handleReset() {
    this.documentModel.setText("");
    // Réglages remis à leur valeur par défaut.
    this.settingsModel.setDifficulty("medium");
    this.settingsModel.setLanguage("auto");
    this.settingsModel.setAttachToCourses(true);
    this.settingsModel.setStoreCourseText(true);
    this.settingsModel.setAccessCode("");
    // Interface en français (valeur par défaut, détection auto sur texte vide).
    this.i18n.setLanguage("fr");
    // Supprime la clé d'accès de sessionStorage si elle y avait été copiée.
    try { sessionStorage.removeItem("accessCode"); } catch { /* ignore */ }
    this.bus.publish("upload:cleared");
    this.bus.publish("app:recommendation", { count: this.settingsModel.recommendCount("") });
  }

  /**
   * Réinitialisation complète depuis l'écran de résultat (bouton « Revenir à
   * l'accueil ») : efface en plus le QuizModel (quiz, réponses, état de jeu).
   * Aucune trace du quiz précédent ne subsiste en mémoire.
   * @returns {void}
   */
  handleHomeReset() {
    this.quizModel.reset();
    this.handleReset();
    this.bus.publish("screen:show", { name: "upload" });
  }

  /**
   * Annule la génération en cours (bouton Annuler de l'écran d'attente).
   * - invalide le jeton pour qu'une réponse tardive n'écrase pas l'état ;
   * - avorte la requête réseau via le Service (AbortController du timeout) ;
   * - revient à l'upload, texte et options intacts (aucune erreur affichée).
   * @returns {void}
   */
  handleCancel() {
    this._genId++;                 // toute génération en vol devient « périmée »
    this.apiClient.cancel();        // avorte la requête (raison "cancel")
    this.bus.publish("screen:show", { name: "upload" });
  }

  /**
   * Traite un PDF sélectionné : validations (type, taille, pages, PDF scanné),
   * extraction via le Service PdfExtractor avec progression, puis remplissage
   * du texte source. Aucune manipulation du DOM ici.
   * @param {File} file
   * @returns {Promise<void>}
   */
  async handlePdf(file) {
    const estPdf = file && (file.type === "application/pdf" || /\.pdf$/i.test(file.name));
    if (!estPdf) return this.bus.publish("app:pdf-error", { message: this.i18n.t("err_pdf_type"), level: "error" });
    // Refus immédiat au-delà de 10 Mo (avant toute lecture).
    if (file.size > 10 * 1024 * 1024) {
      return this.bus.publish("app:pdf-error", { message: this.i18n.t("err_pdf_too_big"), level: "error" });
    }

    this.bus.publish("app:pdf-progress", { page: 0, total: 0 });
    try {
      const res = await this.pdfExtractor.extract(file, {
        maxPages: 40,
        onProgress: (page, total) => this.bus.publish("app:pdf-progress", { page, total }),
      });
      const pages = res.pages.length;
      const chars = res.text.length;

      // PDF scanné : moins de 50 caractères par page en moyenne -> c'est une
      // image. AVERTISSEMENT (pas une erreur) : une action reste possible.
      if (pages > 0 && chars / pages < 50) {
        return this.bus.publish("app:pdf-error", { message: this.i18n.t("err_pdf_scanned"), level: "warn" });
      }

      this.documentModel.setText(res.text); // met à jour compteur/validité
      this.bus.publish("app:recommendation", { count: this.settingsModel.recommendCount(res.text) });
      this.bus.publish("pdf:extracted", { filename: file.name, pages, chars, text: res.text });
    } catch (err) {
      const key = err.code === "TOO_MANY_PAGES" ? "err_pdf_too_many_pages" : "err_pdf_failed";
      this.bus.publish("app:pdf-error", { message: this.i18n.t(key), level: "error" });
    }
  }

  /**
   * Lance la génération : écran d'attente animé, appel API, validation, puis
   * chargement du quiz ou message d'erreur clair.
   * @returns {Promise<void>}
   */
  async handleGenerate() {
    // #3 : blocage CÔTÉ CLIENT si le code d'accès est vide — AUCUN appel réseau,
    // pas de passage par l'écran d'attente. La View met le champ en erreur.
    if (!this.settingsModel.getAccessCode()) {
      return this.bus.publish("ui:access-code-required", {});
    }
    const monTour = ++this._genId; // jeton propre à CETTE génération
    const text = this.documentModel.getText();

    // Interface dans la langue probable pendant l'attente.
    const langueUi = this.settingsModel.language !== "auto"
      ? this.settingsModel.language
      : this.languageDetector.detect(text);
    this.i18n.setLanguage(langueUi);

    this.bus.publish("screen:show", { name: "loading" });
    // Estimation recalibrée sur les mesures HTTP réelles (mesures.md) : base ~10 s,
    // ~0,9 s/question (données : 10 questions → 17-22 s, moy. 19,5 s via serveur).
    // Le texte contribue peu (~0,25 s pour 1 000 caractères). La View affiche une
    // FOURCHETTE (±20-40 % de variance observée).
    const eta = Math.round(10 + 0.9 * Number(this.settingsModel.count) + text.length / 4000);
    this.bus.publish("app:loading-eta", { seconds: eta });
    this.bus.publish("app:loading-step", { step: 0 });
    await pause(300);
    if (monTour !== this._genId) return; // annulée pendant la préparation
    this.bus.publish("app:loading-step", { step: 1 });

    try {
      const payload = { text, ...this.settingsModel.toRequest() };
      const donnees = await this.apiClient.generateQuiz(payload, this.settingsModel.getAccessCode());
      if (monTour !== this._genId) return; // annulée pendant l'appel : ne rien écraser

      this.bus.publish("app:loading-step", { step: 2 });
      const { valid } = this.validator.validate(donnees);
      if (!valid) throw makeError(0, "INVALID_RESPONSE");
      await pause(400); // laisse voir l'étape « vérification »
      if (monTour !== this._genId) return; // annulée pendant la vérification

      // Langue finale = celle réellement produite par le serveur.
      this.i18n.setLanguage(donnees.language);
      // Métadonnées utiles à l'enregistrement. La longueur est ce qui sera
      // stocké côté quiz ; le texte reste EN MÉMOIRE pour le rattachement à un
      // cours (empreinte + option « conserver le texte »), jamais persisté ici.
      donnees.difficulty = this.settingsModel.difficulty;
      donnees.source_length = text.length;
      donnees.source_text = text;
      // Écran « Vérifier les questions » AVANT le quiz.
      this.bus.publish("screen:show", { name: "edit" });
      this.quizModel.load(donnees);
    } catch (err) {
      // Annulation volontaire (err.cancelled) ou génération invalidée par une
      // annulation (jeton périmé) : on ne montre AUCUN message d'erreur.
      if (err.cancelled || monTour !== this._genId) return;
      this.bus.publish("screen:show", { name: "upload" });
      this.bus.publish("app:error", { message: this._message(err) });
    }
  }

  /**
   * Traduit une erreur normalisée d'ApiClient en message clair (par code).
   * @param {{httpStatus:number, backendCode:string}} err
   * @returns {string}
   */
  _message(err) {
    const s = err.httpStatus;
    const code = err.backendCode;
    if (s === 401) return this.i18n.t("err_401");
    if (s === 413) return this.i18n.t("err_413");
    if (s === 429) {
      // On exploite retryAfterSeconds renvoyé par le serveur (arrondi à la minute).
      const min = Math.max(1, Math.ceil((err.retryAfterSeconds || 0) / 60));
      return this.i18n.t("err_429_detail", { min: this.i18n.isoLTR(min) });
    }
    if (s === 400) return code === "TEXT_TOO_SHORT" ? this.i18n.t("err_400_short") : this.i18n.t("err_400");
    if (s === 503) return this.i18n.t("err_daily_quota"); // DAILY_QUOTA_REACHED
    if (s === 502) return this.i18n.t("err_502");
    if (s === 0 && (code === "TIMEOUT" || code === "NETWORK")) return this.i18n.t("err_network");
    return this.i18n.t("err_generic");
  }
}

/** Petite pause asynchrone (pour rythmer l'écran d'attente). */
function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Erreur locale au même format que celles d'ApiClient. */
function makeError(httpStatus, backendCode) {
  const err = new Error(backendCode);
  err.httpStatus = httpStatus;
  err.backendCode = backendCode;
  return err;
}
