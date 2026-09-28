/**
 * EditView.js — Écran « Vérifier les questions » (READ / UPDATE / DELETE / CREATE).
 *
 * COUCHE : View. AUCUNE logique métier : elle rend l'état publié par le
 * QuizModel (edit:changed) et émet des INTENTIONS sur le bus. La validation, la
 * persistance et la règle des 3 questions sont décidées ailleurs (Model/Controller).
 *
 * Tout contenu utilisateur est inséré via textContent (jamais innerHTML) pour
 * éviter toute injection. L'état d'INTERFACE (quelle question est en édition /
 * en confirmation de suppression) est local à la View.
 */
import { pageValide, pageNumero } from "../services/citation.js";

export class EditView {
  /**
   * @param {import("../services/EventBus.js").EventBus} bus
   * @param {import("../services/I18n.js").I18n} i18n
   */
  constructor(bus, i18n) {
    this.bus = bus;
    this.i18n = i18n;

    this.section = document.getElementById("screen-edit");
    this.genSummary = document.getElementById("edit-gen-summary");
    this.list = document.getElementById("edit-list");
    this.addZone = document.getElementById("edit-add-zone");
    this.btnAdd = document.getElementById("btn-add-question");
    this.btnStart = document.getElementById("btn-start-quiz");
    this.btnSaveQuiz = document.getElementById("btn-save-quiz");
    this.savePanel = document.getElementById("edit-save-panel");
    this.message = document.getElementById("edit-message");
    this.messageText = this.message.querySelector(".msg-text");

    // État d'interface local.
    this._data = { questions: [], count: 0, saved: false, code: null };
    this._editingId = null;   // localId en cours d'édition, "new", ou null
    this._confirmingId = null; // localId en attente de confirmation de suppression
    this._slots = null;        // slots d'erreur du formulaire ouvert

    // Intentions statiques.
    this.btnAdd.addEventListener("click", () => { this._editingId = "new"; this._confirmingId = null; this._hideMessage(); this._render(); });
    this.btnStart.addEventListener("click", () => this.bus.publish("ui:start-quiz", {}));
    this.btnSaveQuiz.addEventListener("click", () => this.bus.publish("ui:save-quiz", {}));

    // Réactions.
    this.bus.subscribe("edit:changed", (e) => {
      this._data = e;
      // Un quiz NON enregistré qui se charge (nouvelle génération, révision…)
      // ne doit pas conserver le panneau d'enregistrement d'un quiz précédent.
      if (!e.saved) { this.savePanel.hidden = true; this.savePanel.innerHTML = ""; }
      this._render();
    });
    this.bus.subscribe("edit:save-result", (e) => this._onSaveResult(e));
    this.bus.subscribe("edit:delete-result", (e) => this._onDeleteResult(e));
    this.bus.subscribe("edit:saved", (e) => this._onSaved(e));
    this.bus.subscribe("edit:save-error", ({ message }) => this._showMessage(message));
    this.bus.subscribe("screen:show", ({ name }) => {
      this.section.hidden = name !== "edit";
      if (name === "edit") { this._editingId = null; this._confirmingId = null; this._hideMessage(); this._render(); }
    });
  }

  // ─────────────────────────── Rendu ───────────────────────────────────────
  _render() {
    const t = (k, p) => this.i18n.t(k, p);

    // Résumé de génération : transparence sur les questions écartées à la
    // vérification (« N générées (M rejetées) »). Masqué hors génération.
    const rc = this._data.rejectedCount;
    if (rc != null) {
      const n = this.i18n.isoLTR(this._data.count);
      this.genSummary.textContent = rc > 0
        ? t("edit_gen_summary_rejected", { count: n, rejected: this.i18n.isoLTR(rc) })
        : t("edit_gen_summary", { count: n });
      this.genSummary.hidden = false;
    } else {
      this.genSummary.hidden = true;
    }

    this.list.innerHTML = "";
    this._data.questions.forEach((q, i) => {
      this.list.appendChild(this._editingId === q.localId ? this._formItem(q) : this._readItem(q, i + 1));
    });

    // Zone d'ajout (formulaire vide) sous la liste.
    this.addZone.innerHTML = "";
    if (this._editingId === "new") {
      this.addZone.appendChild(this._formNode(null));
      this.btnAdd.hidden = true;
    } else {
      this.btnAdd.hidden = false;
    }

    // Bouton « Enregistrer » masqué une fois le quiz enregistré.
    this.btnSaveQuiz.hidden = this._data.saved;
    void t; // (t utilisé dans les sous-fonctions)
  }

  /** Vue LECTURE d'une question. */
  _readItem(q, pos) {
    const t = (k, p) => this.i18n.t(k, p);
    const li = el("li", "edit-item");

    const head = el("div", "edit-item-head");
    head.appendChild(txt(el("span", "edit-num"), String(pos)));
    head.appendChild(txt(el("span", "edit-q"), q.question));
    li.appendChild(head);

    const ans = el("div", "edit-answer");
    ans.appendChild(txt(el("span", "edit-answer-label"), t("result_correct_label")));
    ans.appendChild(txt(el("span", "edit-correct"), q.choices[q.correct_index]));
    li.appendChild(ans);

    const meta = el("div", "edit-meta");
    if (q.origin === "manual") {
      meta.appendChild(txt(el("span", "edit-badge"), t("edit_manual_badge")));
    } else if (pageValide(q.source_page)) {
      meta.appendChild(txt(el("span", "edit-page"), t("edit_source_page", { page: pageNumero(q.source_page) })));
    }
    li.appendChild(meta);

    const actions = el("div", "edit-item-actions");
    const bEdit = txt(el("button", "btn-ghost"), t("btn_edit"));
    bEdit.type = "button";
    bEdit.addEventListener("click", () => { this._editingId = q.localId; this._confirmingId = null; this._hideMessage(); this._render(); });
    actions.appendChild(bEdit);

    const bDel = txt(el("button", "btn-ghost edit-del"), t("btn_delete_q"));
    bDel.type = "button";
    if (this._data.count <= 3) {
      bDel.disabled = true;
      const note = txt(el("span", "edit-min-note"), t("edit_min_questions"));
      actions.appendChild(bDel);
      actions.appendChild(note);
    } else {
      bDel.addEventListener("click", () => { this._confirmingId = q.localId; this._render(); });
      actions.appendChild(bDel);
    }
    li.appendChild(actions);

    // Confirmation de suppression EN PLACE (jamais window.confirm).
    if (this._confirmingId === q.localId) {
      const conf = el("div", "edit-confirm");
      conf.appendChild(txt(el("span", ""), t("edit_confirm_delete")));
      const yes = txt(el("button", "btn btn-primary edit-confirm-yes"), t("btn_confirm"));
      yes.type = "button";
      yes.addEventListener("click", () => this.bus.publish("ui:edit-delete", { localId: q.localId, id: q.id }));
      const no = txt(el("button", "btn btn-secondary"), t("btn_cancel"));
      no.type = "button";
      no.addEventListener("click", () => { this._confirmingId = null; this._render(); });
      conf.appendChild(yes);
      conf.appendChild(no);
      li.appendChild(conf);
    }
    return li;
  }

  /** Formulaire d'édition inséré à la place d'une question. */
  _formItem(q) {
    const li = el("li", "edit-item edit-item-editing");
    li.appendChild(this._formNode(q));
    return li;
  }

  /** Construit un formulaire (q null = ajout). Émet ui:edit-save à la validation. */
  _formNode(q) {
    const t = (k, p) => this.i18n.t(k, p);
    const cle = q ? q.localId : "new";
    const form = el("form", "edit-form");

    // Énoncé.
    form.appendChild(txt(el("label", ""), t("edit_field_question")));
    const taQ = el("textarea", "edit-input-question");
    taQ.rows = 2;
    taQ.value = q ? q.question : "";
    form.appendChild(taQ);
    const errQ = errSlot();
    form.appendChild(errQ);

    // Propositions + bouton radio pour la bonne réponse.
    form.appendChild(txt(el("label", ""), t("edit_field_choices")));
    const inputsChoix = [];
    for (let i = 0; i < 4; i++) {
      const row = el("div", "edit-choice-row");
      const radio = el("input", "edit-radio");
      radio.type = "radio";
      radio.name = `edit-correct-${cle}`;
      radio.value = String(i);
      radio.checked = q ? q.correct_index === i : i === 0;
      radio.setAttribute("aria-label", t("edit_choice_correct"));
      const inp = el("input", "edit-choice-input");
      inp.type = "text";
      inp.value = q ? q.choices[i] : "";
      row.appendChild(radio);
      row.appendChild(inp);
      form.appendChild(row);
      inputsChoix.push({ radio, inp });
    }
    const errC = errSlot();
    form.appendChild(errC);

    // Explication.
    form.appendChild(txt(el("label", ""), t("edit_field_explanation")));
    const taE = el("textarea", "edit-input-explanation");
    taE.rows = 2;
    taE.value = q ? q.explanation : "";
    form.appendChild(taE);
    const errE = errSlot();
    form.appendChild(errE);

    // Boutons.
    const actions = el("div", "edit-form-actions");
    const bSave = txt(el("button", "btn btn-primary"), t("btn_save_q"));
    bSave.type = "submit";
    const bCancel = txt(el("button", "btn btn-secondary"), t("btn_cancel"));
    bCancel.type = "button";
    bCancel.addEventListener("click", () => { this._editingId = null; this._render(); });
    actions.appendChild(bSave);
    actions.appendChild(bCancel);
    form.appendChild(actions);

    // Mémorise les slots d'erreur du formulaire ouvert (pour _onSaveResult).
    this._slots = { question: errQ, choices: errC, correct_index: errC, explanation: errE };

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = {
        question: taQ.value,
        choices: inputsChoix.map((c) => c.inp.value),
        correct_index: Number(inputsChoix.find((c) => c.radio.checked)?.radio.value ?? 0),
        explanation: taE.value,
      };
      this.bus.publish("ui:edit-save", { localId: q ? q.localId : null, id: q ? q.id : null, data });
    });
    return form;
  }

  // ─────────────────────────── Réactions ───────────────────────────────────
  _onSaveResult({ ok, errors }) {
    if (ok) {
      this._editingId = null;
      this._render(); // ferme le formulaire (l'état a déjà été re-rendu par edit:changed)
      return;
    }
    // Échec : on affiche les erreurs sous les champs, sans fermer le formulaire.
    if (!this._slots) return;
    for (const slot of new Set(Object.values(this._slots))) { slot.textContent = ""; slot.hidden = true; }
    for (const e of errors || []) {
      const slot = this._slots[e.field] || this._slots.question;
      slot.textContent = this.i18n.t("verr_" + e.code);
      slot.hidden = false;
    }
  }

  _onDeleteResult({ ok, reason }) {
    if (ok) { this._confirmingId = null; this._render(); return; }
    this._confirmingId = null;
    this._render();
    if (reason === "MIN_QUESTIONS") this._showMessage(this.i18n.t("edit_min_questions"));
    else this._showMessage(this.i18n.t("err_generic"));
  }

  _onSaved({ code, ownerKey }) {
    const t = (k) => this.i18n.t(k);
    this._render(); // masque le bouton « Enregistrer »
    this.savePanel.innerHTML = "";
    this.savePanel.hidden = false;

    this.savePanel.appendChild(txt(el("h3", "edit-save-title"), t("edit_saved_title")));

    const rowCode = el("div", "edit-save-row");
    rowCode.appendChild(txt(el("span", "edit-save-label"), t("edit_code_label")));
    rowCode.appendChild(txt(el("span", "edit-save-value"), code));
    this.savePanel.appendChild(rowCode);

    const rowKey = el("div", "edit-save-row");
    rowKey.appendChild(txt(el("span", "edit-save-label"), t("edit_key_label")));
    rowKey.appendChild(txt(el("span", "edit-save-value edit-save-key"), ownerKey));
    const copy = txt(el("button", "btn btn-secondary edit-copy"), t("btn_copy"));
    copy.type = "button";
    copy.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(ownerKey); } catch { /* copie manuelle possible */ }
      copy.textContent = t("copied");
      setTimeout(() => { copy.textContent = t("btn_copy"); }, 1500);
    });
    rowKey.appendChild(copy);
    this.savePanel.appendChild(rowKey);

    const warn = el("p", "msg msg--warn edit-key-warning");
    warn.appendChild(txt(el("span", "msg-text"), t("edit_key_warning")));
    this.savePanel.appendChild(warn);
  }

  _showMessage(msg) {
    this.messageText.textContent = msg;
    this.message.hidden = false;
  }
  _hideMessage() {
    this.message.hidden = true;
    this.messageText.textContent = "";
  }
}

// ─────────────────────────── Petits utilitaires DOM ────────────────────────
function el(tag, className) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  return n;
}
function txt(node, texte) {
  node.textContent = texte;
  return node;
}
function errSlot() {
  const s = el("p", "edit-error");
  s.hidden = true;
  s.setAttribute("role", "alert");
  return s;
}
