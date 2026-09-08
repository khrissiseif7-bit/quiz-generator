/**
 * I18n.js — Internationalisation (fr / ar / en) et bascule RTL.
 *
 * COUCHE : Service transverse (utilisé par les Views pour l'affichage).
 * RÔLE :
 *   - fournir les libellés traduits (attributs data-i18n / data-i18n-placeholder) ;
 *   - basculer la direction du document (dir="rtl" sur <html> pour l'arabe).
 * Aucune logique métier : uniquement présentation/langue.
 */

// Dictionnaire des libellés. Les {placeholders} sont remplacés par t(key, params).
const DICTIONNAIRE = {
  fr: {
    app_title: "Générateur de Quiz",
    upload_title: "Colle ton cours",
    upload_paste: "Texte du cours",
    upload_placeholder: "Colle ici le texte de ton cours…",
    label_count: "Questions",
    label_difficulty: "Difficulté",
    label_language: "Langue",
    label_access_code: "Code d'accès",
    access_placeholder: "Code d'accès",
    diff_easy: "Facile", diff_medium: "Moyen", diff_hard: "Difficile",
    lang_auto: "Auto", lang_fr: "Français", lang_ar: "Arabe", lang_en: "Anglais",
    btn_generate: "Générer le quiz",
    counter: "{n} caractères",
    hint_too_short: "Encore {n} caractères (minimum 300)",
    hint_too_long: "Trop long (maximum {max} caractères)",
    hint_ok: "Longueur suffisante",
    loading_title: "Génération en cours…",
    loading_step1: "Préparation du texte",
    loading_step2: "Génération des questions",
    loading_step3: "Vérification des réponses",
    quiz_progress: "Question {i} / {n}",
    verdict_correct: "Bonne réponse !",
    verdict_wrong: "Mauvaise réponse",
    source_intro: "D'après ton cours :",
    btn_next: "Suivant",
    btn_finish: "Voir le résultat",
    result_title: "Résultat",
    result_percent: "{p}% de bonnes réponses",
    result_missed: "Questions à revoir",
    result_correct_label: "Bonne réponse :",
    btn_replay_errors: "Rejouer les erreurs",
    btn_flashcards: "Voir les flashcards",
    btn_new_quiz: "Nouveau quiz",
    flashcards_title: "Flashcards",
    flashcard_hint: "Touche la carte pour la retourner",
    flashcard_progress: "Carte {i} — reste {n}",
    btn_review: "À revoir",
    btn_known: "Je savais",
    flashcards_done: "Paquet terminé 🎉",
    btn_back_result: "Retour au résultat",
    err_401: "Code d'accès invalide.",
    err_400_short: "Texte trop court (minimum 300 caractères).",
    err_400: "Requête invalide, vérifie les options.",
    err_413: "Texte trop long.",
    err_429: "Trop de demandes. Réessaie dans un moment.",
    err_502: "Service indisponible pour le moment. Réessaie.",
    err_network: "Connexion au serveur impossible. Réessaie.",
    err_generic: "Une erreur est survenue. Réessaie.",
  },
  en: {
    app_title: "Quiz Generator",
    upload_title: "Paste your course",
    upload_paste: "Course text",
    upload_placeholder: "Paste your course text here…",
    label_count: "Questions",
    label_difficulty: "Difficulty",
    label_language: "Language",
    label_access_code: "Access code",
    access_placeholder: "Access code",
    diff_easy: "Easy", diff_medium: "Medium", diff_hard: "Hard",
    lang_auto: "Auto", lang_fr: "French", lang_ar: "Arabic", lang_en: "English",
    btn_generate: "Generate quiz",
    counter: "{n} characters",
    hint_too_short: "{n} more characters needed (minimum 300)",
    hint_too_long: "Too long (maximum {max} characters)",
    hint_ok: "Length is sufficient",
    loading_title: "Generating…",
    loading_step1: "Preparing the text",
    loading_step2: "Generating questions",
    loading_step3: "Checking the answers",
    quiz_progress: "Question {i} / {n}",
    verdict_correct: "Correct!",
    verdict_wrong: "Wrong answer",
    source_intro: "From your course:",
    btn_next: "Next",
    btn_finish: "See result",
    result_title: "Result",
    result_percent: "{p}% correct",
    result_missed: "Questions to review",
    result_correct_label: "Correct answer:",
    btn_replay_errors: "Replay mistakes",
    btn_flashcards: "See flashcards",
    btn_new_quiz: "New quiz",
    flashcards_title: "Flashcards",
    flashcard_hint: "Tap the card to flip it",
    flashcard_progress: "Card {i} — {n} left",
    btn_review: "To review",
    btn_known: "I knew it",
    flashcards_done: "Deck finished 🎉",
    btn_back_result: "Back to result",
    err_401: "Invalid access code.",
    err_400_short: "Text too short (minimum 300 characters).",
    err_400: "Invalid request, check the options.",
    err_413: "Text too long.",
    err_429: "Too many requests. Try again in a moment.",
    err_502: "Service unavailable right now. Try again.",
    err_network: "Cannot reach the server. Try again.",
    err_generic: "Something went wrong. Try again.",
  },
  ar: {
    app_title: "مولّد الاختبارات",
    upload_title: "الصق درسك",
    upload_paste: "نص الدرس",
    upload_placeholder: "الصق هنا نص درسك…",
    label_count: "الأسئلة",
    label_difficulty: "الصعوبة",
    label_language: "اللغة",
    label_access_code: "رمز الدخول",
    access_placeholder: "رمز الدخول",
    diff_easy: "سهل", diff_medium: "متوسط", diff_hard: "صعب",
    lang_auto: "تلقائي", lang_fr: "الفرنسية", lang_ar: "العربية", lang_en: "الإنجليزية",
    btn_generate: "أنشئ الاختبار",
    counter: "{n} حرفًا",
    hint_too_short: "يلزم {n} حرفًا إضافيًا (الحد الأدنى 300)",
    hint_too_long: "طويل جدًا (الحد الأقصى {max} حرفًا)",
    hint_ok: "الطول كافٍ",
    loading_title: "جارٍ الإنشاء…",
    loading_step1: "تحضير النص",
    loading_step2: "توليد الأسئلة",
    loading_step3: "التحقق من الإجابات",
    quiz_progress: "السؤال {i} / {n}",
    verdict_correct: "إجابة صحيحة!",
    verdict_wrong: "إجابة خاطئة",
    source_intro: "حسب درسك:",
    btn_next: "التالي",
    btn_finish: "عرض النتيجة",
    result_title: "النتيجة",
    result_percent: "{p}% إجابات صحيحة",
    result_missed: "أسئلة للمراجعة",
    result_correct_label: "الإجابة الصحيحة:",
    btn_replay_errors: "أعد الأخطاء",
    btn_flashcards: "عرض البطاقات",
    btn_new_quiz: "اختبار جديد",
    flashcards_title: "البطاقات التعليمية",
    flashcard_hint: "المس البطاقة لقلبها",
    flashcard_progress: "البطاقة {i} — تبقّى {n}",
    btn_review: "للمراجعة",
    btn_known: "كنت أعرفها",
    flashcards_done: "انتهى المجموعة 🎉",
    btn_back_result: "العودة إلى النتيجة",
    err_401: "رمز الدخول غير صالح.",
    err_400_short: "النص قصير جدًا (الحد الأدنى 300 حرف).",
    err_400: "طلب غير صالح، تحقّق من الخيارات.",
    err_413: "النص طويل جدًا.",
    err_429: "طلبات كثيرة جدًا. أعد المحاولة بعد قليل.",
    err_502: "الخدمة غير متاحة حاليًا. أعد المحاولة.",
    err_network: "تعذّر الاتصال بالخادم. أعد المحاولة.",
    err_generic: "حدث خطأ ما. أعد المحاولة.",
  },
};

export class I18n {
  constructor() {
    /** @type {"fr"|"ar"|"en"} Langue courante. */
    this.langue = "fr";
  }

  /**
   * Change la langue active, met à jour la direction du document et réapplique
   * les traductions au DOM.
   * @param {"fr"|"ar"|"en"} langue
   * @returns {void}
   */
  setLanguage(langue) {
    if (!DICTIONNAIRE[langue]) return;
    this.langue = langue;
    document.documentElement.lang = langue;
    document.documentElement.dir = langue === "ar" ? "rtl" : "ltr";
    this.applyTo(document);
  }

  /** @returns {"fr"|"ar"|"en"} Langue courante. */
  getLanguage() {
    return this.langue;
  }

  /**
   * Traduit une clé dans la langue courante, avec substitution de {placeholders}.
   * @param {string} key
   * @param {Record<string, string|number>} [params]
   * @returns {string} Libellé traduit (ou la clé si absente).
   */
  t(key, params = {}) {
    const table = DICTIONNAIRE[this.langue] || DICTIONNAIRE.fr;
    let texte = table[key] != null ? table[key] : key;
    for (const [nom, valeur] of Object.entries(params)) {
      texte = texte.replace(new RegExp(`\\{${nom}\\}`, "g"), String(valeur));
    }
    return texte;
  }

  /**
   * Applique les traductions à tous les éléments [data-i18n] (texte) et
   * [data-i18n-placeholder] (placeholder) sous une racine donnée.
   * @param {ParentNode} [root=document]
   * @returns {void}
   */
  applyTo(root = document) {
    root.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = this.t(el.getAttribute("data-i18n"));
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.setAttribute("placeholder", this.t(el.getAttribute("data-i18n-placeholder")));
    });
  }
}
