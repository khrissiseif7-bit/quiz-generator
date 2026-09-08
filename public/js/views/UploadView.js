/**
 * UploadView.js — Vue de l'écran d'import (collage de texte + options + code).
 *
 * COUCHE : View. AUCUNE logique métier (ni validation, ni appel de service).
 * Elle lit/écrit le DOM de #screen-upload, émet des INTENTIONS sur le bus, et
 * réagit aux événements des Models (document:changed) et de l'app (app:error).
 * Les seuils de longueur sont calculés par DocumentModel : ici on ne fait
 * qu'AFFICHER les indicateurs (compteur, message, bouton activé/désactivé).
 */
import { MAX_LEN } from "../models/DocumentModel.js";

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
    this.hint = document.getElementById("length-hint");
    this.selCount = document.getElementById("select-count");
    this.selDifficulty = document.getElementById("select-difficulty");
    this.selLanguage = document.getElementById("select-language");
    this.inputCode = document.getElementById("input-access-code");
    this.error = document.getElementById("upload-error");
    this.btnGenerate = document.getElementById("btn-generate");

    // Zone de dépôt PDF.
    this.dropzone = document.getElementById("pdf-dropzone");
    this.filePdf = document.getElementById("file-pdf");
    this.pdfProgress = document.getElementById("pdf-progress");
    this.pdfSummary = document.getElementById("pdf-summary");

    // --- Intentions utilisateur (DOM -> bus) ---
    this.textarea.addEventListener("input", () => {
      this.bus.publish("ui:text-changed", { text: this.textarea.value });
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
    this.inputCode.addEventListener("input", () => {
      this.bus.publish("ui:access-code-changed", { code: this.inputCode.value });
    });
    this.btnGenerate.addEventListener("click", () => {
      this.bus.publish("ui:generate", {});
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
    this.bus.subscribe("app:error", ({ message }) => this._showError(message));
    this.bus.subscribe("screen:show", ({ name }) => {
      this.section.hidden = name !== "upload";
      if (name === "loading") this._hideError(); // nouvel essai en cours
    });

    // Extraction PDF : progression, puis remplissage du textarea + résumé.
    this.bus.subscribe("app:pdf-progress", ({ page, total }) => {
      this.pdfSummary.hidden = true;
      this.pdfProgress.hidden = false;
      this.pdfProgress.textContent = total > 0
        ? this.i18n.t("pdf_extracting", { page, total })
        : this.i18n.t("pdf_extracting_start");
    });
    this.bus.subscribe("pdf:extracted", ({ filename, pages, chars, text }) => {
      this.textarea.value = text; // texte modifiable par l'utilisateur avant génération
      this.pdfProgress.hidden = true;
      this.pdfSummary.hidden = false;
      this.pdfSummary.textContent = this.i18n.t("pdf_summary", { filename, pages, chars });
    });
    // Quand la langue de l'interface change, le contrôleur re-publie l'état du
    // texte pour re-traduire compteur/indice.
  }

  /**
   * Met à jour le compteur, l'indice de longueur et l'état du bouton.
   * @param {{length:number, tooShort:boolean, tooLong:boolean, valid:boolean, manque:number}} e
   */
  _renderCounter(e) {
    this.counter.textContent = this.i18n.t("counter", { n: e.length });
    if (e.tooShort) {
      this.hint.textContent = this.i18n.t("hint_too_short", { n: e.manque });
      this.hint.classList.remove("ok");
    } else if (e.tooLong) {
      this.hint.textContent = this.i18n.t("hint_too_long", { max: MAX_LEN });
      this.hint.classList.remove("ok");
    } else {
      this.hint.textContent = this.i18n.t("hint_ok");
      this.hint.classList.add("ok");
    }
    this.btnGenerate.disabled = !e.valid;
  }

  _showError(message) {
    this.error.textContent = message;
    this.error.hidden = false;
    this.pdfProgress.hidden = true; // une erreur interrompt l'affichage de l'extraction
  }

  _hideError() {
    this.error.hidden = true;
    this.error.textContent = "";
  }
}
