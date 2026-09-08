/**
 * app.js — Point d'entrée du front (SPA vanilla, ES modules).
 *
 * RÔLE : composition root. SEUL endroit où l'on instancie et câble les Models,
 * les Views et les Controllers autour d'un EventBus partagé.
 *
 * RÈGLES D'ARCHITECTURE (MVC strict) :
 *   - Les Models ne touchent JAMAIS au DOM.
 *   - Les Views ne contiennent AUCUNE logique métier.
 *   - Les Controllers sont les SEULS à appeler les Services.
 *   - Model -> View passe TOUJOURS par l'EventBus.
 */

import { EventBus } from "./services/EventBus.js";
import { I18n } from "./services/I18n.js";
import { ApiClient } from "./services/ApiClient.js";
import { Validator } from "./services/Validator.js";
import { LanguageDetector } from "./services/LanguageDetector.js";
import { PdfExtractor } from "./services/PdfExtractor.js";

import { DocumentModel } from "./models/DocumentModel.js";
import { QuizModel } from "./models/QuizModel.js";
import { SettingsModel } from "./models/SettingsModel.js";

import { UploadView } from "./views/UploadView.js";
import { LoadingView } from "./views/LoadingView.js";
import { QuizView } from "./views/QuizView.js";
import { ResultView } from "./views/ResultView.js";
import { FlashcardView } from "./views/FlashcardView.js";

import { UploadController } from "./controllers/UploadController.js";
import { QuizController } from "./controllers/QuizController.js";

/**
 * Amorce l'application une fois le DOM prêt.
 * @returns {void}
 */
function bootstrap() {
  // 1. Bus partagé + services.
  const bus = new EventBus();
  const i18n = new I18n();
  const apiClient = new ApiClient();
  const validator = new Validator();
  const languageDetector = new LanguageDetector();
  const pdfExtractor = new PdfExtractor();

  // 2. Models (reçoivent le bus).
  const documentModel = new DocumentModel(bus);
  const quizModel = new QuizModel(bus);
  const settingsModel = new SettingsModel(bus);

  // 3. Views (reçoivent bus + i18n ; s'abonnent au bus dans leur constructeur).
  /* eslint-disable no-new */
  new UploadView(bus, i18n);
  new LoadingView(bus, i18n);
  new QuizView(bus, i18n);
  new ResultView(bus, i18n);
  new FlashcardView(bus, i18n);
  /* eslint-enable no-new */

  // 4. Controllers (injection des Models et Services).
  new UploadController({
    bus, documentModel, settingsModel, quizModel,
    apiClient, validator, languageDetector, pdfExtractor, i18n,
  });
  new QuizController({ bus, quizModel });

  // 5. État initial : langue par défaut, écran d'upload, compteur à zéro.
  i18n.setLanguage("fr");
  bus.publish("screen:show", { name: "upload" });
  documentModel.setText(""); // rend le compteur/indice et garde le bouton désactivé
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
