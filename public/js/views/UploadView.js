/**
 * UploadView.js — Vue de l'écran d'import (collage de texte + options + code).
 *
 * COUCHE : View. AUCUNE logique métier (ni validation, ni appel de service).
 * Elle lit/écrit le DOM de #screen-upload, émet des INTENTIONS sur le bus, et
 * réagit aux événements des Models (document:changed) et de l'app (app:error).
 * Les seuils de longueur sont calculés par DocumentModel : ici on ne fait
 * qu'AFFICHER les indicateurs (compteur, message, bouton activé/désactivé).
 */
import { MAX_LEN, MIN_LEN } from "../models/DocumentModel.js";

export class UploadView {
  /**
   * @param {import("../services/EventBus.js").EventBus} bus
   * @param {import("../services/I18n.js").I18n} i18n
   */
  constructor(bus, i18n) {
    this.bus = bus;
    this.i18n = i18n;

    this.section = document.getElementById("screen-upload");
    this.textarea = document.getElementById("textarea-source");
    this.counter = document.getElementById("char-counter");
    this.warning = document.getElementById("length-warning");
    this.warningText = this.warning.querySelector(".msg-text");
    this.selCount = document.getElementById("select-count");
    this.selDifficulty = document.getElementById("select-difficulty");
    this.selLanguage = document.getElementById("select-language");
    this.inputCode = document.getElementById("input-access-code");
    this.error = document.getElementById("upload-error");
    this.errorText = this.error.querySelector(".msg-text");
    this.btnGenerate = document.getElementById("btn-generate");
    this.btnReset = document.getElementById("btn-reset");

    // Options « cours », recommandation du nombre de questions, ouverture par code.
    this.courseOptions = document.getElementById("course-options");
    this.checkAttach = document.getElementById("check-attach");
    this.checkStore = document.getElementById("check-store-text");
    this.inputOpenCode = document.getElementById("input-open-code");
    this.inputOpenKey = document.getElementById("input-open-key");
    this.btnOpenQuiz = document.getElementById("btn-open-quiz");
    this.openError = document.getElementById("open-error");
    this.openErrorText = this.openError.querySelector(".msg-text");
    this._reco = null;             // dernier nombre de questions recommandé
    this._userChoseCount = false;  // l'utilisateur a-t-il fixé le nombre lui-même ?

    // Zone de dépôt PDF + son message (info / avertissement / erreur).
    this.dropzone = document.getElementById("pdf-dropzone");
    this.filePdf = document.getElementById("file-pdf");
    this.pdfMessage = document.getElementById("pdf-message");
    this.pdfMessageText = this.pdfMessage.querySelector(".msg-text");

    // --- Intentions utilisateur (DOM -> bus) ---
    this.textarea.addEventListener("input", () => {
      this.bus.publish("ui:text-changed", { text: this.textarea.value });
      this._updateReset();
    });
    const emettreReglages = () => {
      this.bus.publish("ui:settings-changed", {
        count: this.selCount.value,
        difficulty: this.selDifficulty.value,
        language: this.selLanguage.value,
      });
    };
    this.selCount.addEventListener("change", emettreReglages);
    this.selDifficulty.addEventListener("change", emettreReglages);
    this.selLanguage.addEventListener("change", emettreReglages);
    // Dès que l'utilisateur touche au nombre, on cesse de le repositionner sur
    // la recommandation (il reste libre de son choix).
    this.selCount.addEventListener("change", () => { this._userChoseCount = true; });
    this.inputCode.addEventListener("input", () => {
      // Dès qu'on saisit, on lève l'état d'erreur « code requis ».
      this.inputCode.classList.remove("field-error");
      this._hideError();
      this.bus.publish("ui:access-code-changed", { code: this.inputCode.value });
    });

    // Options « cours » (cases à cocher).
    const emettreOptionsCours = () => this.bus.publish("ui:course-options-changed", {
      attach: this.checkAttach.checked, storeText: this.checkStore.checked,
    });
    this.checkAttach.addEventListener("change", () => {
      // « Conserver le texte » n'a de sens que si l'on rattache à un cours :
      // désactivé sinon, et coché par défaut dès que le rattachement est actif.
      this.checkStore.disabled = !this.checkAttach.checked;
      this.checkStore.checked = this.checkAttach.checked;
      emettreOptionsCours();
    });
    this.checkStore.addEventListener("change", emettreOptionsCours);

    // Ouverture d'un quiz existant par code.
    this.btnOpenQuiz.addEventListener("click", () => {
      this._hideOpenError();
      this.bus.publish("ui:open-quiz", { code: this.inputOpenCode.value, ownerKey: this.inputOpenKey.value });
    });
    this.btnGenerate.addEventListener("click", () => {
      this.bus.publish("ui:generate", {});
    });
    this.btnReset.addEventListener("click", () => {
      this.bus.publish("ui:reset", {}); // le Controller vide le Model ; la View efface son DOM
    });

    // --- Dépôt PDF (clic + glisser-déposer) : on émet seulement l'intention ;
    //     la validation (taille, pages, scanné) est faite par le Controller. ---
    this.dropzone.addEventListener("click", () => this.filePdf.click());
    this.dropzone.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); this.filePdf.click(); }
    });
    this.filePdf.addEventListener("change", () => {
      const fichier = this.filePdf.files && this.filePdf.files[0];
      if (fichier) this.bus.publish("ui:pdf-selected", { file: fichier });
      this.filePdf.value = ""; // autorise à re-choisir le même fichier
    });
    ["dragenter", "dragover"].forEach((evt) =>
      this.dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        this.dropzone.classList.add("dragover");
      })
    );
    ["dragleave", "dragend"].forEach((evt) =>
      this.dropzone.addEventListener(evt, () => this.dropzone.classList.remove("dragover"))
    );
    this.dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      this.dropzone.classList.remove("dragover");
      const fichier = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (fichier) this.bus.publish("ui:pdf-selected", { file: fichier });
    });

    // --- Réactions aux événements ---
    this.bus.subscribe("document:changed", (e) => this._renderCounter(e));
    // Recommandation du nombre de questions + erreurs d'ouverture par code.
    this.bus.subscribe("app:recommendation", ({ count }) => this._applyRecommendation(count));
    this.bus.subscribe("open:error", ({ message }) => this._showOpenError(message));
    // « Réviser » un cours sans texte conservé : invitation à re-déposer.
    this.bus.subscribe("app:revise-invite", ({ message }) => this._setPdfMessage(message, "info"));
    // #3 : le Controller a bloqué la génération faute de code d'accès.
    this.bus.subscribe("ui:access-code-required", () => this._requireAccessCode());
    // Erreurs d'ENVOI (génération) : zone au-dessus du bouton Générer.
    this.bus.subscribe("app:error", ({ message }) => this._showError(message));
    this.bus.subscribe("screen:show", ({ name }) => {
      this.section.hidden = name !== "upload";
      if (name === "loading") this._hideError(); // nouvel essai en cours
    });

    // Extraction PDF : progression puis résumé (info), sous la zone de dépôt.
    this.bus.subscribe("app:pdf-progress", ({ page, total }) => {
      const t = total > 0
        ? this.i18n.t("pdf_extracting", { page, total })
        : this.i18n.t("pdf_extracting_start");
      this._setPdfMessage(t, "info");
    });
    this.bus.subscribe("pdf:extracted", ({ filename, pages, chars, text }) => {
      this.textarea.value = text; // texte modifiable par l'utilisateur avant génération
      this._setPdfMessage(this.i18n.t("pdf_summary", { filename, pages, chars }), "info");
      this.dropzone.classList.add("loaded"); // bordure accent = fichier chargé
      this._updateReset();
    });
    // Avertissements / erreurs PDF (scanné = warn, autres = error) : même zone.
    this.bus.subscribe("app:pdf-error", ({ message, level }) => {
      this._setPdfMessage(message, level || "error");
      this.dropzone.classList.remove("loaded");
      this._updateReset();
    });
    // Réinitialisation demandée par le Controller : on efface le DOM de l'upload.
    this.bus.subscribe("upload:cleared", () => this._clear());
    // Quand la langue de l'interface change, le contrôleur re-publie l'état du
    // texte pour re-traduire compteur/indice.
  }

  /**
   * Efface les éléments DOM de l'upload : textarea, résumé et input fichier
   * (réinitialisé pour pouvoir redéposer le MÊME fichier), progression, erreur.
   * NE touche NI au code d'accès NI aux options (gérés ailleurs).
   */
  _clear() {
    this.textarea.value = "";
    this.filePdf.value = "";
    this._clearPdfMessage();
    this.dropzone.classList.remove("loaded");
    this._hideError();
    this._updateReset();
    // La recommandation repart de zéro pour un prochain cours.
    this._reco = null;
    this._userChoseCount = false;
    this.courseOptions.hidden = true;
  }

  /**
   * Affiche le bouton Réinitialiser uniquement s'il y a quelque chose à effacer :
   * textarea non vide OU fichier PDF chargé.
   */
  _updateReset() {
    const aEffacer = this.textarea.value.trim() !== "" || this.dropzone.classList.contains("loaded");
    this.btnReset.hidden = !aEffacer;
  }

  /**
   * Met à jour le compteur (une SEULE information) et l'état du bouton :
   *   - sous le seuil : « X / 300 caractères minimum » en --text-muted ;
   *   - seuil franchi : « X caractères » en --correct ;
   *   - trop long : message maximum en --incorrect.
   * La fraction et le nombre sont isolés en LTR (lisibles en arabe).
   * @param {{length:number, tooShort:boolean, tooLong:boolean, valid:boolean, manque:number, long:boolean}} e
   */
  _renderCounter(e) {
    this.counter.classList.remove("ok", "warn");
    if (e.tooShort) {
      const frac = this.i18n.isoLTR(`${e.length} / ${MIN_LEN}`);
      this.counter.textContent = this.i18n.t("counter_min", { frac });
    } else if (e.tooLong) {
      this.counter.textContent = this.i18n.t("hint_too_long", { max: MAX_LEN });
      this.counter.classList.add("warn");
    } else {
      const n = this.i18n.isoLTR(grouperMilliers(e.length));
      this.counter.textContent = this.i18n.t("counter", { n });
      this.counter.classList.add("ok");
    }
    // Avertissement « texte long » : génération lente à prévoir.
    if (e.long) {
      this.warningText.textContent = this.i18n.t("hint_long");
      this.warning.hidden = false;
    } else {
      this.warning.hidden = true;
    }
    this.btnGenerate.disabled = !e.valid;
    // Options « cours » visibles seulement quand il y a un cours exploitable.
    this.courseOptions.hidden = !e.valid;
    if (this._reco != null) this._updateRecoLabels();
  }

  /** Affiche une erreur d'ENVOI dans la zone au-dessus du bouton Générer. */
  _showError(message) {
    this.errorText.textContent = message;
    this.error.hidden = false;
  }

  _hideError() {
    this.error.hidden = true;
    this.errorText.textContent = "";
  }

  /**
   * Affiche un message dans la zone PDF (sous la zone de dépôt), avec son niveau.
   * @param {string} text
   * @param {"info"|"warn"|"error"} level
   */
  _setPdfMessage(text, level) {
    this.pdfMessageText.textContent = text;
    this.pdfMessage.className = "msg msg--" + level;
    this.pdfMessage.hidden = false;
  }

  _clearPdfMessage() {
    this.pdfMessage.hidden = true;
    this.pdfMessageText.textContent = "";
  }

  /**
   * Applique la recommandation du nombre de questions : marque l'option
   * « (recommandé) » et, tant que l'utilisateur n'a pas choisi lui-même, s'y
   * positionne (en mettant à jour le Model via une intention).
   * @param {5|10|15} count
   */
  _applyRecommendation(count) {
    this._reco = count;
    this._updateRecoLabels();
    if (!this._userChoseCount) {
      this.selCount.value = String(count);
      this.bus.publish("ui:settings-changed", {
        count: this.selCount.value,
        difficulty: this.selDifficulty.value,
        language: this.selLanguage.value,
      });
    }
  }

  /** Ajoute « (recommandé) » à l'option recommandée (dans la langue courante). */
  _updateRecoLabels() {
    const suffixe = this.i18n.t("recommended_suffix");
    for (const opt of this.selCount.options) {
      opt.textContent = Number(opt.value) === this._reco ? opt.value + suffixe : opt.value;
    }
  }

  /** Met le champ code d'accès en erreur, le focus, et affiche le message. */
  _requireAccessCode() {
    this.inputCode.classList.add("field-error");
    this.inputCode.focus();
    this._showError(this.i18n.t("err_access_required"));
  }

  _showOpenError(message) {
    this.openErrorText.textContent = message;
    this.openError.hidden = false;
  }
  _hideOpenError() {
    this.openError.hidden = true;
    this.openErrorText.textContent = "";
  }
}

/**
 * Groupe les milliers avec une espace fine insécable : 4427 -> « 4 427 ».
 * Indépendant de la langue (le nombre est isolé en LTR à l'affichage).
 * @param {number} n
 * @returns {string}
 */
function grouperMilliers(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
