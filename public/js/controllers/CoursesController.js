/**
 * CoursesController.js — Orchestration de l'onglet « Mes cours » et du détail.
 *
 * COUCHE : Controller. Lit les cours connus de ce navigateur (CourseStore =
 * localStorage), interroge l'API pour leur score/tentatives, et pilote les
 * actions : voir le détail, réviser (re-générer), supprimer.
 *
 * Intentions écoutées :
 *   ui:open-courses · ui:course-detail {code} · ui:course-revise {code} · ui:course-delete {code}
 * Événements publiés :
 *   courses:loading · courses:list {courses[]} · course:detail {course} · courses:error {message}
 */
export class CoursesController {
  /**
   * @param {object} deps
   * @param {import("../services/EventBus.js").EventBus} deps.bus
   * @param {import("../services/QuizApiClient.js").QuizApiClient} deps.quizApiClient
   * @param {import("../services/CourseStore.js").CourseStore} deps.courseStore
   * @param {import("../models/SettingsModel.js").SettingsModel} deps.settingsModel
   * @param {import("../models/DocumentModel.js").DocumentModel} deps.documentModel
   * @param {import("../services/I18n.js").I18n} deps.i18n
   */
  constructor(deps) {
    Object.assign(this, deps);
    this.bus.subscribe("ui:open-courses", () => this.handleOpen());
    this.bus.subscribe("ui:course-detail", (e) => this.handleDetail(e));
    this.bus.subscribe("ui:course-revise", (e) => this.handleRevise(e));
    this.bus.subscribe("ui:course-delete", (e) => this.handleDelete(e));
    this.bus.subscribe("ui:course-remove-text", (e) => this.handleRemoveText(e));
  }

  /**
   * Supprime le TEXTE conservé d'un cours sans supprimer le cours
   * (PUT /courses/:code, storeText=false), puis recharge le détail.
   * @param {{code:string}} e
   */
  async handleRemoveText({ code }) {
    const connu = this.courseStore.get(code);
    try {
      await this.quizApiClient.updateCourse(code, { storeText: false }, this.settingsModel.getAccessCode(), connu?.ownerKey);
      this.handleDetail({ code });
    } catch {
      this.bus.publish("courses:error", { message: this.i18n.t("err_generic") });
    }
  }

  /** Affiche l'écran « Mes cours » et charge chaque cours connu localement. */
  async handleOpen() {
    this.bus.publish("screen:show", { name: "courses" });
    this.bus.publish("courses:loading", {});
    const acc = this.settingsModel.getAccessCode();
    const cours = [];
    for (const c of this.courseStore.all()) {
      try {
        const d = await this.quizApiClient.getCourse(c.code, acc, c.ownerKey);
        cours.push({ ...d, ownerKey: c.ownerKey });
      } catch (err) {
        // Cours supprimé côté serveur -> on nettoie le local. Erreur réseau -> on ignore.
        if (err.httpStatus === 404) this.courseStore.remove(c.code);
      }
    }
    this.bus.publish("courses:list", { courses: cours });
  }

  /** Ouvre le détail d'un cours (courbe des scores + tentatives). */
  async handleDetail({ code }) {
    const connu = this.courseStore.get(code);
    try {
      const d = await this.quizApiClient.getCourse(code, this.settingsModel.getAccessCode(), connu?.ownerKey);
      this.bus.publish("screen:show", { name: "course-detail" });
      this.bus.publish("course:detail", { course: { ...d, ownerKey: connu?.ownerKey } });
    } catch {
      this.bus.publish("courses:error", { message: this.i18n.t("err_generic") });
    }
  }

  /**
   * Réviser : si le texte est conservé, on préremplit et on génère directement ;
   * sinon on invite à re-déposer le document (il sera reconnu par son empreinte).
   */
  async handleRevise({ code }) {
    const connu = this.courseStore.get(code);
    const acc = this.settingsModel.getAccessCode();
    try {
      const d = await this.quizApiClient.getCourse(code, acc, connu?.ownerKey);
      this.i18n.setLanguage(d.language);
      this.settingsModel.setLanguage(d.language);
      if (d.text) {
        // Texte conservé -> génération directe (si le code d'accès est déjà saisi).
        this.documentModel.setText(d.text);
        this.bus.publish("app:recommendation", { count: this.settingsModel.recommendCount(d.text) });
        this.bus.publish("screen:show", { name: "upload" });
        if (acc) this.bus.publish("ui:generate", {});
      } else {
        // Texte non conservé -> invitation à re-déposer (reconnaissance par empreinte).
        this.documentModel.setText("");
        this.bus.publish("screen:show", { name: "upload" });
        this.bus.publish("app:revise-invite", { message: this.i18n.t("revise_reupload") });
      }
    } catch {
      this.bus.publish("courses:error", { message: this.i18n.t("err_generic") });
    }
  }

  /** Supprime un cours (serveur + local) puis recharge la liste. */
  async handleDelete({ code }) {
    const connu = this.courseStore.get(code);
    try {
      await this.quizApiClient.deleteCourse(code, this.settingsModel.getAccessCode(), connu?.ownerKey);
    } catch {
      /* même en cas d'erreur serveur, on retire le cours du navigateur */
    }
    this.courseStore.remove(code);
    this.handleOpen();
  }
}
