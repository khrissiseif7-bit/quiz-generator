/**
 * UploadController.js — Orchestration de l'écran d'import.
 *
 * COUCHE : Controller.
 * RÈGLES :
 *   - Les Controllers sont les SEULS à appeler les Services.
 *   - Le Controller écoute les intentions UI (via bus), invoque les Services
 *     (PdfExtractor, LanguageDetector, ApiClient, Validator), met à jour les
 *     Models, et laisse les Models notifier les Views via le bus.
 *   - Le Controller ne manipule PAS le DOM directement.
 */
export class UploadController {
  /**
   * @param {object} deps - Dépendances injectées par app.js.
   * @param {import("../services/EventBus.js").EventBus} deps.bus
   * @param {import("../models/DocumentModel.js").DocumentModel} deps.documentModel
   * @param {import("../models/SettingsModel.js").SettingsModel} deps.settingsModel
   * @param {import("../models/QuizModel.js").QuizModel} deps.quizModel
   * @param {import("../services/PdfExtractor.js").PdfExtractor} deps.pdfExtractor
   * @param {import("../services/LanguageDetector.js").LanguageDetector} deps.languageDetector
   * @param {import("../services/ApiClient.js").ApiClient} deps.apiClient
   * @param {import("../services/Validator.js").Validator} deps.validator
   */
  constructor(deps) {
    // TODO: mémoriser les dépendances.
    // TODO: s'abonner aux intentions UI : "ui:file-selected", "ui:generate-requested",
    //       et aux changements de réglages issus de la barre d'outils.
  }

  /**
   * Gère un PDF déposé : extrait le texte via PdfExtractor puis alimente le DocumentModel.
   * @param {File} file - Fichier PDF sélectionné.
   * @returns {Promise<void>}
   */
  async handleFile(file) {
    // TODO: appeler pdfExtractor.extract(file) -> {text, pages}, puis documentModel.setSource(...).
    // TODO: détecter la langue via languageDetector et documentModel.setLanguage(...).
  }

  /**
   * Gère la demande de génération : construit la requête, appelle l'API, valide, charge le quiz.
   * @returns {Promise<void>}
   */
  async handleGenerate() {
    // TODO: lire texte (DocumentModel) + réglages (SettingsModel).
    // TODO: appeler apiClient.generateQuiz(payload).
    // TODO: valider la réponse via validator.validate(...) (conforme au contrat).
    // TODO: en cas de succès, quizModel.load(quiz) puis publier une transition d'écran.
    // TODO: en cas d'erreur (401/413/429/502/validation), publier "app:error" avec message i18n.
  }
}
