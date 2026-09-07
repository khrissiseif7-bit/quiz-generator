/**
 * app.js — Point d'entrée du front (SPA vanilla, ES modules).
 *
 * RÔLE : composition root de l'application. C'est le SEUL endroit où l'on
 * instancie et câble ensemble les Models, les Views et les Controllers.
 *
 * RÈGLES D'ARCHITECTURE (MVC strict) rappelées ici et appliquées partout :
 *   - Les Models ne touchent JAMAIS au DOM.
 *   - Les Views ne contiennent AUCUNE logique métier (ni score, ni validation).
 *   - Les Controllers sont les SEULS à appeler les Services.
 *   - La communication Model -> View passe TOUJOURS par l'EventBus,
 *     jamais par un appel direct.
 *
 * FLUX DE CÂBLAGE :
 *   1. Créer un EventBus partagé.
 *   2. Instancier les Models (DocumentModel, QuizModel, SettingsModel) avec le bus.
 *   3. Instancier les Views (Upload, Quiz, Flashcard, Result) avec le bus + I18n.
 *   4. Instancier les Controllers (Upload, Quiz) avec models, views et services.
 *   5. Initialiser l'I18n et afficher l'écran d'upload.
 */

import { EventBus } from "./services/EventBus.js";
import { I18n } from "./services/I18n.js";
import { DocumentModel } from "./models/DocumentModel.js";
import { QuizModel } from "./models/QuizModel.js";
import { SettingsModel } from "./models/SettingsModel.js";
import { UploadView } from "./views/UploadView.js";
import { QuizView } from "./views/QuizView.js";
import { FlashcardView } from "./views/FlashcardView.js";
import { ResultView } from "./views/ResultView.js";
import { UploadController } from "./controllers/UploadController.js";
import { QuizController } from "./controllers/QuizController.js";

/**
 * Amorce l'application une fois le DOM prêt.
 * Entrées : aucune.
 * Sorties : aucune (effets de bord : instanciation + rendu initial).
 */
function bootstrap() {
  // TODO: instancier l'EventBus partagé.
  // TODO: instancier I18n et charger la langue par défaut.
  // TODO: instancier les Models en leur passant le bus.
  // TODO: instancier les Views en leur passant le bus (+ I18n).
  // TODO: instancier les Services (ApiClient, PdfExtractor, Validator,
  //       LanguageDetector) requis par les Controllers.
  // TODO: instancier les Controllers en injectant models/views/services.
  // TODO: afficher l'écran d'upload.
}

// TODO: appeler bootstrap() au chargement du DOM (DOMContentLoaded).
