/**
 * CoursesView.js — Écrans « Mes cours » (liste) et détail d'un cours.
 *
 * COUCHE : View. Rend la liste des cours (anneau de score coloré, date de
 * dernière révision, nombre de quiz, actions) et le détail (courbe SVG des
 * scores + tentatives). N'émet que des intentions ; ne connaît ni l'API ni le
 * stockage. Tout contenu utilisateur est inséré via textContent.
 *
 * Seuils de couleur de l'anneau : < 50 = --incorrect, 50–79 = --signature,
 * >= 80 = --correct.
 */
const NS = "http://www.w3.org/2000/svg";

export class CoursesView {
  /**
   * @param {import("../services/EventBus.js").EventBus} bus
   * @param {import("../services/I18n.js").I18n} i18n
   */
  constructor(bus, i18n) {
    this.bus = bus;
    this.i18n = i18n;

    this.section = document.getElementById("screen-courses");
    this.detailSection = document.getElementById("screen-course-detail");
    this.list = document.getElementById("courses-list");
    this.empty = document.getElementById("courses-empty");
    this.loading = document.getElementById("courses-loading");
    this.detailTitle = document.getElementById("course-detail-title");
    this.detailBody = document.getElementById("course-detail-body");
    this.btnNav = document.getElementById("btn-nav-courses");
    this.btnHome = document.getElementById("btn-courses-home");
    this.btnBack = document.getElementById("btn-course-back");

    this._confirmDelete = null;     // code du cours en attente de confirmation (suppression)
    this._confirmRemoveText = null; // code du cours en attente de confirmation (suppression du texte)
    this._detailCourse = null;      // cours actuellement affiché en détail (pour re-render local)

    // #5 : le bouton d'en-tête mène à « Mes cours », ou revient à « Accueil »
    // quand on est déjà sur un écran cours.
    this.btnNav.addEventListener("click", () => {
      if (this._onCoursesScreen) this.bus.publish("screen:show", { name: "upload" });
      else this.bus.publish("ui:open-courses", {});
    });
    this.btnHome.addEventListener("click", () => this.bus.publish("screen:show", { name: "upload" }));
    this.btnBack.addEventListener("click", () => this.bus.publish("ui:open-courses", {}));

    this.bus.subscribe("screen:show", ({ name }) => {
      this.section.hidden = name !== "courses";
      this.detailSection.hidden = name !== "course-detail";
      // #5 : bascule du libellé du bouton d'en-tête (data-i18n pour suivre la langue).
      this._onCoursesScreen = name === "courses" || name === "course-detail";
      const cle = this._onCoursesScreen ? "nav_home_short" : "nav_courses";
      this.btnNav.setAttribute("data-i18n", cle);
      this.btnNav.textContent = this.i18n.t(cle);
    });
    this.bus.subscribe("courses:loading", () => { this.loading.hidden = false; this.empty.hidden = true; this.list.innerHTML = ""; });
    this.bus.subscribe("courses:list", (e) => this._renderList(e.courses));
    this.bus.subscribe("course:detail", (e) => this._renderDetail(e.course));
  }

  // ─────────────────────────── Liste ───────────────────────────────────────
  _renderList(courses) {
    this.loading.hidden = true;
    this._courses = courses;
    this._confirmDelete = null;
    this._paint();
  }

  /** (Re)dessine la liste à partir de l'état courant (sans re-interroger l'API). */
  _paint() {
    this.list.innerHTML = "";
    this.empty.hidden = this._courses.length > 0;
    for (const c of this._courses) this.list.appendChild(this._card(c));
  }

  _card(c) {
    const t = (k, p) => this.i18n.t(k, p);
    const li = el("li", "course-card");

    // Anneau de score (ou tiret si aucune tentative).
    const gauche = el("div", "course-card-ring");
    if (c.displayedScore != null) gauche.appendChild(this._ring(c.displayedScore));
    else gauche.appendChild(txt(el("span", "course-ring-none"), "—"));
    li.appendChild(gauche);

    // Infos.
    const info = el("div", "course-card-info");
    info.appendChild(txt(el("div", "course-card-title"), c.title));
    const meta = el("div", "course-card-meta");
    meta.appendChild(txt(el("span", ""), t("course_quizzes_count", { n: c.quizzes.length })));
    meta.appendChild(txt(el("span", ""), t("course_last_review", { date: this._date(c.last_attempt_at) })));
    meta.appendChild(txt(el("span", c.hasStoredText ? "course-badge-stored" : "course-badge-nostore"),
      c.hasStoredText ? t("course_stored_badge") : t("course_not_stored")));
    info.appendChild(meta);
    li.appendChild(info);

    // Actions (ou confirmation de suppression en place).
    const actions = el("div", "course-card-actions");
    if (this._confirmDelete === c.code) {
      actions.appendChild(txt(el("span", "course-confirm-text"), t("course_confirm_delete")));
      const yes = txt(el("button", "btn btn-primary"), t("btn_confirm"));
      yes.type = "button";
      yes.addEventListener("click", () => this.bus.publish("ui:course-delete", { code: c.code }));
      const no = txt(el("button", "btn btn-secondary"), t("btn_cancel"));
      no.type = "button";
      no.addEventListener("click", () => { this._confirmDelete = null; this._paint(); });
      actions.append(yes, no);
    } else {
      const detail = txt(el("button", "btn-ghost"), t("btn_detail"));
      detail.type = "button";
      detail.addEventListener("click", () => this.bus.publish("ui:course-detail", { code: c.code }));
      // #6 : deux modes distincts selon que le texte est conservé.
      const revise = txt(el("button", "btn btn-secondary"), t(c.hasStoredText ? "btn_revise_new" : "btn_revise"));
      revise.type = "button";
      revise.title = t(c.hasStoredText ? "revise_tip_stored" : "revise_tip_reupload");
      revise.addEventListener("click", () => this.bus.publish("ui:course-revise", { code: c.code }));
      const del = txt(el("button", "btn-ghost course-del"), t("btn_delete_course"));
      del.type = "button";
      del.addEventListener("click", () => { this._confirmDelete = c.code; this._paint(); });
      actions.append(detail, revise, del);
    }
    li.appendChild(actions);
    return li;
  }

  // ─────────────────────────── Détail ──────────────────────────────────────
  _renderDetail(course) {
    const t = (k, p) => this.i18n.t(k, p);
    this._detailCourse = course;
    this.detailTitle.textContent = course.title;
    this.detailBody.innerHTML = "";

    // En-tête : anneau + scores.
    const tete = el("div", "course-detail-head");
    if (course.displayedScore != null) tete.appendChild(this._ring(course.displayedScore));
    else tete.appendChild(txt(el("span", "course-ring-none"), "—"));
    const scores = el("div", "course-detail-scores");
    if (course.score != null) {
      scores.appendChild(txt(el("div", ""), t("course_score_stored", { pct: this.i18n.isoLTR(course.score + "%") })));
      scores.appendChild(txt(el("div", "course-detail-displayed"), t("course_score_displayed", { pct: this.i18n.isoLTR(course.displayedScore + "%") })));
    } else {
      scores.appendChild(txt(el("div", ""), t("course_score_none")));
    }
    scores.appendChild(txt(el("div", "course-detail-review"), t("course_last_review", { date: this._date(course.last_attempt_at) })));
    tete.appendChild(scores);
    this.detailBody.appendChild(tete);

    // Courbe des scores dans le temps.
    this.detailBody.appendChild(txt(el("h3", "course-section-title"), t("course_chart_title")));
    this.detailBody.appendChild(this._chart(course.attempts || []));

    // Historique des tentatives.
    this.detailBody.appendChild(txt(el("h3", "course-section-title"), t("course_detail_attempts")));
    if (!course.attempts || course.attempts.length === 0) {
      this.detailBody.appendChild(txt(el("p", "edit-intro"), t("course_no_attempts")));
    } else {
      const ol = el("ol", "course-attempts");
      for (const a of [...course.attempts].reverse()) {
        const pct = a.total ? Math.round((a.score / a.total) * 100) : 0;
        ol.appendChild(txt(el("li", ""), t("course_attempt_line", {
          date: this._dateTime(a.created_at), // #12 : date ET heure
          frac: this.i18n.isoLTR(`${a.score}/${a.total}`),
          pct: this.i18n.isoLTR(pct + "%"),
        })));
      }
      this.detailBody.appendChild(ol);
    }

    // Quiz de ce cours.
    this.detailBody.appendChild(txt(el("h3", "course-section-title"), t("course_quizzes")));
    const olq = el("ol", "course-quizzes");
    for (const q of course.quizzes || []) {
      olq.appendChild(txt(el("li", ""), `${q.title} — ${this.i18n.isoLTR(q.code)}`));
    }
    this.detailBody.appendChild(olq);

    // Révision + gestion du texte conservé (réservé au propriétaire).
    if (course.isOwner) this._renderReviseSection(course);
  }

  /**
   * Section « révision » du détail : selon que le texte est conservé ou non.
   * - conservé : bouton « Réviser avec de nouvelles questions » + interrupteur
   *   « Texte conservé » (suppression avec confirmation en place) ;
   * - non conservé : état explicite « re-déposez-le pour réviser » + bouton
   *   qui ramène à l'écran d'upload.
   * @param {object} course
   */
  _renderReviseSection(course) {
    const t = (k, p) => this.i18n.t(k, p);
    const sec = el("div", "course-revise-section");

    if (course.hasStoredText) {
      const btn = txt(el("button", "btn btn-primary"), t("btn_revise_new"));
      btn.type = "button";
      btn.title = t("revise_tip_stored");
      btn.addEventListener("click", () => this.bus.publish("ui:course-revise", { code: course.code }));
      sec.appendChild(btn);
      sec.appendChild(txt(el("p", "course-revise-help"), t("revise_help_stored")));

      if (this._confirmRemoveText === course.code) {
        const conf = el("div", "course-confirm-remove");
        conf.appendChild(txt(el("p", ""), t("course_remove_text_confirm")));
        const yes = txt(el("button", "btn btn-primary"), t("btn_confirm"));
        yes.type = "button";
        yes.addEventListener("click", () => this.bus.publish("ui:course-remove-text", { code: course.code }));
        const no = txt(el("button", "btn btn-secondary"), t("btn_cancel"));
        no.type = "button";
        no.addEventListener("click", () => { this._confirmRemoveText = null; this._renderDetail(this._detailCourse); });
        conf.append(yes, no);
        sec.appendChild(conf);
      } else {
        const sw = el("label", "course-switch");
        const cb = el("input", "");
        cb.type = "checkbox";
        cb.checked = true;
        cb.addEventListener("change", () => { this._confirmRemoveText = course.code; this._renderDetail(this._detailCourse); });
        sw.append(cb, txt(el("span", ""), t("course_text_kept")));
        sec.appendChild(sw);
      }
    } else {
      const box = el("div", "course-not-stored-box");
      box.appendChild(txt(el("p", "course-not-stored-msg"), t("course_not_stored_state")));
      const btn = txt(el("button", "btn btn-secondary"), t("btn_reupload"));
      btn.type = "button";
      btn.title = t("revise_tip_reupload");
      btn.addEventListener("click", () => this.bus.publish("ui:course-revise", { code: course.code }));
      box.appendChild(btn);
      sec.appendChild(box);
    }
    this.detailBody.appendChild(sec);
  }

  // ─────────────────────────── Fabriques SVG ───────────────────────────────
  /** Anneau de score coloré selon le seuil. */
  _ring(percent) {
    const size = 72, r = 30, C = 2 * Math.PI * r;
    const wrap = el("div", "course-ring-wrap");
    const svg = svg2("svg", { viewBox: `0 0 ${size} ${size}`,
      class: "course-ring " + (percent < 50 ? "ring-low" : percent < 80 ? "ring-mid" : "ring-high") });
    svg.appendChild(svg2("circle", { class: "course-ring-bg", cx: size / 2, cy: size / 2, r }));
    svg.appendChild(svg2("circle", {
      class: "course-ring-fg", cx: size / 2, cy: size / 2, r,
      transform: `rotate(-90 ${size / 2} ${size / 2})`,
      "stroke-dasharray": C, "stroke-dashoffset": C * (1 - percent / 100),
    }));
    wrap.appendChild(svg);
    wrap.appendChild(txt(el("span", "course-ring-label"), this.i18n.isoLTR(Math.round(percent) + "%")));
    return wrap;
  }

  /** Courbe simple des scores (pourcentage) dans le temps, en SVG inline. */
  _chart(attempts) {
    const W = 320, H = 130, L = 8, R = 8, T = 12, B = 16;
    const svg = svg2("svg", { viewBox: `0 0 ${W} ${H}`, class: "course-chart", role: "img" });
    const yFor = (p) => T + ((100 - p) / 100) * (H - T - B);
    // Repères horizontaux à 50 % et 80 %.
    for (const g of [50, 80]) {
      svg.appendChild(svg2("line", { class: "chart-grid", x1: L, x2: W - R, y1: yFor(g), y2: yFor(g) }));
    }
    const n = attempts.length;
    const xFor = (i) => (n <= 1 ? W / 2 : L + i * ((W - L - R) / (n - 1)));
    const pts = attempts.map((a, i) => ({ x: xFor(i), y: yFor(a.total ? (a.score / a.total) * 100 : 0) }));
    if (pts.length >= 2) {
      svg.appendChild(svg2("polyline", { class: "chart-line", points: pts.map((p) => `${p.x},${p.y}`).join(" ") }));
    }
    for (const p of pts) {
      svg.appendChild(svg2("circle", { class: "chart-dot", cx: p.x, cy: p.y, r: 3 }));
    }
    if (n === 0) {
      const txtel = svg2("text", { class: "chart-empty", x: W / 2, y: H / 2, "text-anchor": "middle" });
      txtel.textContent = this.i18n.t("course_no_attempts");
      svg.appendChild(txtel);
    }
    return svg;
  }

  /** Formate une date (ms epoch) selon la langue, ou « jamais » si absente. */
  _date(ms) {
    if (!ms) return this.i18n.t("course_never");
    try {
      return new Date(ms).toLocaleDateString(this.i18n.getLanguage(), { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return new Date(ms).toISOString().slice(0, 10);
    }
  }

  /** Formate date ET heure (ex. « 16/09/2026 14:32 »), isolée en LTR pour l'arabe. */
  _dateTime(ms) {
    if (!ms) return this.i18n.t("course_never");
    const d = new Date(ms);
    try {
      return this.i18n.isoLTR(d.toLocaleString(this.i18n.getLanguage(), {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      }));
    } catch {
      return this.i18n.isoLTR(d.toISOString().slice(0, 16).replace("T", " "));
    }
  }
}

// ─────────────────────────── Utilitaires DOM/SVG ───────────────────────────
function el(tag, className) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  return n;
}
function txt(node, texte) { node.textContent = texte; return node; }
function svg2(tag, attrs) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
}
