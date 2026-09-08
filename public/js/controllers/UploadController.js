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

    this.bus.subscribe("ui:text-changed", ({ text }) => {
      this.documentModel.setText(text);
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
    if (!estPdf) return this.bus.publish("app:error", { message: this.i18n.t("err_pdf_type") });
    // Refus immédiat au-delà de 10 Mo (avant toute lecture).
    if (file.size > 10 * 1024 * 1024) {
      return this.bus.publish("app:error", { message: this.i18n.t("err_pdf_too_big") });
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
      // image. On informe l'utilisateur, sans tenter d'OCR.
      if (pages > 0 && chars / pages < 50) {
        return this.bus.publish("app:error", { message: this.i18n.t("err_pdf_scanned") });
      }

      this.documentModel.setText(res.text); // met à jour compteur/validité
      this.bus.publish("pdf:extracted", { filename: file.name, pages, chars, text: res.text });
    } catch (err) {
      const key = err.code === "TOO_MANY_PAGES" ? "err_pdf_too_many_pages" : "err_pdf_failed";
      this.bus.publish("app:error", { message: this.i18n.t(key) });
    }
  }

  /**
   * Lance la génération : écran d'attente animé, appel API, validation, puis
   * chargement du quiz ou message d'erreur clair.
   * @returns {Promise<void>}
   */
  async handleGenerate() {
    const text = this.documentModel.getText();

    // Interface dans la langue probable pendant l'attente.
    const langueUi = this.settingsModel.language !== "auto"
      ? this.settingsModel.language
      : this.languageDetector.detect(text);
    this.i18n.setLanguage(langueUi);

    this.bus.publish("screen:show", { name: "loading" });
    this.bus.publish("app:loading-step", { step: 0 });
    await pause(300);
    this.bus.publish("app:loading-step", { step: 1 });

    try {
      const payload = { text, ...this.settingsModel.toRequest() };
      const donnees = await this.apiClient.generateQuiz(payload, this.settingsModel.getAccessCode());

      this.bus.publish("app:loading-step", { step: 2 });
      const { valid } = this.validator.validate(donnees);
      if (!valid) throw makeError(0, "INVALID_RESPONSE");
      await pause(400); // laisse voir l'étape « vérification »

      // Langue finale = celle réellement produite par le serveur.
      this.i18n.setLanguage(donnees.language);
      this.bus.publish("screen:show", { name: "quiz" });
      this.quizModel.load(donnees);
    } catch (err) {
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
    if (s === 429) return this.i18n.t("err_429");
    if (s === 400) return code === "TEXT_TOO_SHORT" ? this.i18n.t("err_400_short") : this.i18n.t("err_400");
    if (s === 502 || s === 503) return this.i18n.t("err_502");
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
