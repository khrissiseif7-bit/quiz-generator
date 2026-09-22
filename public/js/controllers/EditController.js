/**
 * EditController.js — Orchestration de l'écran « Vérifier les questions ».
 *
 * COUCHE : Controller. SEUL à appeler les Services (QuizApiClient). Applique le
 * principe : tant que le quiz n'est pas enregistré, le CRUD agit sur le
 * QuizModel EN MÉMOIRE (validation dans le Model) ; une fois enregistré, chaque
 * modification passe par l'API, puis on resynchronise le Model depuis le serveur
 * (pour récupérer les ids réels des questions).
 *
 * Intentions écoutées (émises par EditView) :
 *   ui:edit-save   { localId|null, id|null, data }  (ajout si localId null)
 *   ui:edit-delete { localId, id|null }
 *   ui:start-quiz
 *   ui:save-quiz
 * Résultats publiés (écoutés par EditView) :
 *   edit:save-result   { localId, ok, errors? }
 *   edit:delete-result { localId, ok, reason? }
 *   edit:saved         { code, ownerKey }
 *   edit:save-error    { message }
 */
export class EditController {
  /**
   * @param {object} deps
   * @param {import("../services/EventBus.js").EventBus} deps.bus
   * @param {import("../models/QuizModel.js").QuizModel} deps.quizModel
   * @param {import("../models/SettingsModel.js").SettingsModel} deps.settingsModel
   * @param {import("../services/QuizApiClient.js").QuizApiClient} deps.quizApiClient
   * @param {import("../services/I18n.js").I18n} deps.i18n
   */
  constructor(deps) {
    Object.assign(this, deps);

    this.bus.subscribe("ui:edit-save", (e) => this.handleSave(e));
    this.bus.subscribe("ui:edit-delete", (e) => this.handleDelete(e));
    this.bus.subscribe("ui:start-quiz", () => this.handleStart());
    this.bus.subscribe("ui:save-quiz", () => this.handleSaveQuiz());
  }

  /** Ajout (localId null) ou modification d'une question. */
  async handleSave({ localId, id, data }) {
    if (!this.quizModel.saved) {
      // ── En mémoire ──
      const res = localId == null
        ? this.quizModel.addQuestionLocal(data)
        : this.quizModel.updateQuestionLocal(localId, data);
      return this.bus.publish("edit:save-result", { localId, ok: res.ok, errors: res.errors });
    }
    // ── Via l'API (quiz enregistré) ──
    const code = this.quizModel.code;
    const acc = this.settingsModel.getAccessCode();
    const key = this.quizModel.ownerKey;
    try {
      if (id == null) await this.quizApiClient.addQuestion(code, data, acc, key);
      else await this.quizApiClient.updateQuestion(code, id, data, acc, key);
      await this._resync();
      this.bus.publish("edit:save-result", { localId, ok: true });
    } catch (err) {
      this.bus.publish("edit:save-result", { localId, ok: false, errors: this._champs(err) });
    }
  }

  /** Suppression d'une question (refus sous 3 questions). */
  async handleDelete({ localId, id }) {
    if (!this.quizModel.saved) {
      const res = this.quizModel.removeQuestionLocal(localId);
      return this.bus.publish("edit:delete-result", { localId, ok: res.ok, reason: res.reason });
    }
    const code = this.quizModel.code;
    const acc = this.settingsModel.getAccessCode();
    const key = this.quizModel.ownerKey;
    try {
      await this.quizApiClient.deleteQuestion(code, id, acc, key);
      await this._resync();
      this.bus.publish("edit:delete-result", { localId, ok: true });
    } catch (err) {
      const reason = err.httpStatus === 409 ? "MIN_QUESTIONS" : "ERROR";
      this.bus.publish("edit:delete-result", { localId, ok: false, reason });
    }
  }

  /** Démarre le quiz à partir des questions éditées. */
  handleStart() {
    this.bus.publish("screen:show", { name: "quiz" });
    this.quizModel.startPlay();
  }

  /**
   * Enregistre le quiz (POST /quizzes) puis resynchronise (ids serveur).
   * Si l'utilisateur a demandé le rattachement à un cours, on crée (ou retrouve
   * par empreinte) le cours d'abord, on mémorise sa clé localement, et on
   * rattache le quiz — le serveur exige la clé du COURS pour ce rattachement.
   */
  async handleSaveQuiz() {
    if (this.quizModel.saved) return; // déjà enregistré
    const acc = this.settingsModel.getAccessCode();
    try {
      let courseOwnerKey;

      if (this.settingsModel.attachToCourses && this.quizModel.sourceText) {
        const cours = await this.quizApiClient.createCourse({
          title: this.quizModel.title,
          text: this.quizModel.sourceText,
          language: this.quizModel.language,
          storeText: this.settingsModel.storeCourseText,
        }, acc);

        if (cours.ownerKey) {
          // Cours nouvellement créé : on garde sa clé dans ce navigateur.
          this.courseStore.add({ code: cours.code, ownerKey: cours.ownerKey, title: this.quizModel.title, language: this.quizModel.language });
          courseOwnerKey = cours.ownerKey;
        } else {
          // Cours déjà connu (même empreinte) : on récupère sa clé locale.
          const connu = this.courseStore.get(cours.code);
          courseOwnerKey = connu ? connu.ownerKey : null;
        }
        // On ne rattache que si l'on possède la clé du cours (sinon 403).
        this.quizModel.courseCode = courseOwnerKey ? cours.code : null;
      }

      const { code, ownerKey } = await this.quizApiClient.saveQuiz(
        this.quizModel.toSavePayload(), acc, courseOwnerKey
      );
      this.quizModel.markSaved(code, ownerKey);
      await this._resync();
      this.bus.publish("edit:saved", { code, ownerKey });
    } catch (err) {
      this.bus.publish("edit:save-error", { message: this._message(err) });
    }
  }

  /** Recharge le quiz depuis le serveur et resynchronise le Model (ids réels). */
  async _resync() {
    const full = await this.quizApiClient.getQuiz(this.quizModel.code, this.settingsModel.getAccessCode());
    this.quizModel.syncFromServer(full);
  }

  /** Extrait les erreurs de champ d'une VALIDATION_ERROR (sinon message générique). */
  _champs(err) {
    if (err.httpStatus === 400 && Array.isArray(err.details)) return err.details;
    return [{ field: "question", code: "SERVER_ERROR" }];
  }

  /** Message clair pour l'écran (erreurs d'enregistrement). */
  _message(err) {
    const c = err.backendCode;
    if (err.httpStatus === 429) return this.i18n.t("err_429");
    if (err.httpStatus === 403) return this.i18n.t("err_save_forbidden");
    if (err.httpStatus === 400 && c === "VALIDATION_ERROR") return this.i18n.t("err_save_invalid");
    if (err.httpStatus === 0) return this.i18n.t("err_network");
    return this.i18n.t("err_generic");
  }
}
