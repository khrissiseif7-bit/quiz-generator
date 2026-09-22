/**
 * test-crud.js — Banc d'essai du CRUD REST (persistance SQLite).
 *
 * Démarre l'application sur une base EN MÉMOIRE (DB_PATH=:memory:) et un code
 * d'accès dédié, puis déroule tout le parcours attendu via HTTP :
 *   Quiz : créer, lire, modifier une question, en ajouter une (manuelle),
 *          en supprimer une, refuser sans clé (403), refuser la suppression
 *          sous 3 questions (409), enregistrer une tentative, lire les stats,
 *          supprimer le quiz, vérifier le 404.
 *   Cours : créer, re-créer avec le même texte (même code), rattacher deux quiz,
 *          trois tentatives et évolution du score, décroissance affichée avec
 *          une date antérieure simulée, suppression en cascade.
 *   Service de score : formules pures (moyenne pondérée + courbe de l'oubli).
 *
 * Lancement :  node scripts/test-crud.js
 */

// Environnement AVANT tout import du serveur (dotenv ne surcharge pas ces vars).
process.env.DB_PATH = ":memory:";
process.env.ACCESS_CODE = "test-crud-code";

const { createApp } = await import("../server/server.js");
const repo = await import("../server/services/quiz.repository.js");
const score = await import("../server/services/score.service.js");

const ACCESS = "test-crud-code";

// ── Petit cadre de test ───────────────────────────────────────────────────
let reussis = 0;
let echecs = 0;
function check(nom, condition, details = "") {
  if (condition) {
    reussis++;
    console.log(`  ✓ ${nom}`);
  } else {
    echecs++;
    console.log(`  ✗ ${nom}${details ? "  → " + details : ""}`);
  }
}
function section(titre) {
  console.log(`\n── ${titre} ──`);
}
function proche(a, b, tol = 0.2) {
  return Math.abs(a - b) <= tol;
}

// ── Serveur de test + client HTTP ─────────────────────────────────────────
const app = createApp();
const server = app.listen(0);
await new Promise((r) => server.once("listening", r));
const base = `http://127.0.0.1:${server.address().port}`;

async function api(method, chemin, { body, ownerKey, noAccess } = {}) {
  const headers = {};
  if (!noAccess) headers["X-Access-Code"] = ACCESS; // noAccess : on OMET le code d'accès
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (ownerKey) headers["X-Owner-Key"] = ownerKey;
  const res = await fetch(base + chemin, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* 204 : pas de corps */ }
  return { status: res.status, body: json };
}

// Fabrique d'une question valide (générée) pour les créations.
function questionAI(n) {
  return {
    question: `Question ${n} : que vaut ${n} + ${n} ?`,
    choices: [`${n + n}`, `${n + n + 1}`, `${n}`, `${n * n + 7}`],
    correct_index: 0,
    explanation: `La somme de ${n} et ${n} vaut ${n + n}, par addition simple.`,
    source_excerpt: `exemple ${n} tiré du cours`,
    source_page: 1,
    origin: "ai",
  };
}

const corpsQuiz = (courseCode = null) => ({
  title: "Quiz de test",
  language: "fr",
  difficulty: "medium",
  source_length: 1234,
  course_code: courseCode,
  questions: [questionAI(1), questionAI(2), questionAI(3), questionAI(4)],
  flashcards: [{ front: "Recto", back: "Verso", source_page: 1 }],
});

try {
  // ═══════════════════════════ SERVICE DE SCORE (pur) ═════════════════════
  section("Service de score (formules pures)");
  check("première tentative = résultat brut (8/10 -> 80)",
    score.calculerNouveauScore(null, 8, 10) === 80,
    String(score.calculerNouveauScore(null, 8, 10)));
  check("moyenne pondérée (prev 80, 5/10 -> 62)",
    score.calculerNouveauScore(80, 5, 10) === 62,
    String(score.calculerNouveauScore(80, 5, 10)));
  check("aucune décroissance à 0 jour",
    score.scoreAffiche(80, 0) === 80, String(score.scoreAffiche(80, 0)));
  check("décroissance à 14 jours ~ 80/e (29.4)",
    proche(score.scoreAffiche(80, 14), 80 / Math.E, 0.5),
    String(score.scoreAffiche(80, 14)));

  // ═══════════════════════════ QUIZ : CRUD ════════════════════════════════
  section("Quiz : création & lecture");
  const cr = await api("POST", "/quizzes", { body: corpsQuiz() });
  check("POST /quizzes -> 201", cr.status === 201, `status ${cr.status}`);
  check("réponse contient code + ownerKey (32c)",
    !!cr.body?.code && cr.body?.ownerKey?.length === 32);
  const code = cr.body.code;
  const ownerKey = cr.body.ownerKey;

  const lu = await api("GET", `/quizzes/${code}`);
  check("GET /quizzes/:code -> 200", lu.status === 200, `status ${lu.status}`);
  check("4 questions lues", lu.body?.questions?.length === 4);
  check("le hash propriétaire n'est PAS exposé", lu.body?.owner_key_hash === undefined);
  check("origin 'ai' sur les questions générées", lu.body.questions[0].origin === "ai");

  section("Code d'accès : LECTURE libre, ÉCRITURE protégée");
  // Lectures SANS code d'accès -> autorisées (aucun quota LLM).
  check("GET /quizzes/:code sans code d'accès -> 200",
    (await api("GET", `/quizzes/${code}`, { noAccess: true })).status === 200);
  check("GET /quizzes/:code/stats sans code d'accès -> 200",
    (await api("GET", `/quizzes/${code}/stats`, { noAccess: true })).status === 200);
  const coursLecture = await api("POST", "/courses", { body: { title: "Accès", text: "Texte de cours pour tester la lecture sans code d'accès. ".repeat(4), language: "fr" } });
  check("GET /courses/:code sans code d'accès -> 200",
    (await api("GET", `/courses/${coursLecture.body.code}`, { noAccess: true })).status === 200);
  // Écritures SANS code d'accès -> refusées (401).
  check("POST /quizzes sans code d'accès -> 401",
    (await api("POST", "/quizzes", { body: corpsQuiz(), noAccess: true })).status === 401);
  check("POST /attempts sans code d'accès -> 401",
    (await api("POST", `/quizzes/${code}/attempts`, { body: { score: 1, total: 3 }, noAccess: true })).status === 401);
  check("DELETE /quizzes/:code sans code d'accès (même avec la clé) -> 401",
    (await api("DELETE", `/quizzes/${code}`, { ownerKey, noAccess: true })).status === 401);

  section("Quiz : refus sans clé propriétaire (403)");
  const sansCle = await api("PUT", `/quizzes/${code}`, { body: { title: "Pirate" } });
  check("PUT sans X-Owner-Key -> 403", sansCle.status === 403, `status ${sansCle.status}`);
  const mauvaiseCle = await api("DELETE", `/quizzes/${code}/questions/1`, { ownerKey: "x".repeat(32) });
  check("DELETE question avec mauvaise clé -> 403", mauvaiseCle.status === 403, `status ${mauvaiseCle.status}`);

  section("Quiz : modifier / ajouter / supprimer une question");
  const q1 = lu.body.questions[0];
  const majQ = await api("PUT", `/quizzes/${code}/questions/${q1.id}`, {
    ownerKey,
    body: { question: "Question modifiée ?", choices: ["A", "B", "C", "D"], correct_index: 2, explanation: "Explication modifiée, suffisamment longue." },
  });
  check("PUT question -> 200", majQ.status === 200, `status ${majQ.status}`);
  check("question bien modifiée", majQ.body?.question === "Question modifiée ?" && majQ.body?.correct_index === 2);

  const ajout = await api("POST", `/quizzes/${code}/questions`, {
    ownerKey,
    body: { question: "Ajoutée à la main ?", choices: ["1", "2", "3", "4"], correct_index: 1, explanation: "Une explication manuelle valable." },
  });
  check("POST question -> 201", ajout.status === 201, `status ${ajout.status}`);
  check("origin forcé à 'manual'", ajout.body?.origin === "manual");
  check("pas de source_excerpt (question manuelle)", ajout.body?.source_excerpt === null);

  const valErr = await api("POST", `/quizzes/${code}/questions`, {
    ownerKey,
    body: { question: "Doublons ?", choices: ["A", "A", "B", "C"], correct_index: 0, explanation: "Explication valable ici." },
  });
  check("POST question à choix dupliqués -> 400 VALIDATION_ERROR",
    valErr.status === 400 && valErr.body?.error === "VALIDATION_ERROR", `status ${valErr.status}`);
  check("détail du champ fautif présent",
    Array.isArray(valErr.body?.details) && valErr.body.details.some((d) => d.code === "DUPLICATE_CHOICES"));

  // On a maintenant 5 questions. Suppression de celle ajoutée -> 4.
  const supprAjout = await api("DELETE", `/quizzes/${code}/questions/${ajout.body.id}`, { ownerKey });
  check("DELETE question -> 204", supprAjout.status === 204, `status ${supprAjout.status}`);

  section("Quiz : plancher de 3 questions (409)");
  // Il reste 4 questions : une suppression est permise (reste 3)...
  const listeApres = (await api("GET", `/quizzes/${code}`)).body.questions;
  const suppr1 = await api("DELETE", `/quizzes/${code}/questions/${listeApres[0].id}`, { ownerKey });
  check("suppression jusqu'à 3 questions -> 204", suppr1.status === 204, `status ${suppr1.status}`);
  // ...mais pas en dessous de 3.
  const restantes = (await api("GET", `/quizzes/${code}`)).body.questions;
  const suppr2 = await api("DELETE", `/quizzes/${code}/questions/${restantes[0].id}`, { ownerKey });
  check("suppression sous 3 questions -> 409 CONFLICT",
    suppr2.status === 409 && suppr2.body?.error === "CONFLICT", `status ${suppr2.status}`);

  section("Quiz : tentative + stats");
  const att = await api("POST", `/quizzes/${code}/attempts`, { body: { score: 2, total: 3 } });
  check("POST /attempts -> 201", att.status === 201, `status ${att.status}`);
  check("stats renvoyées avec la tentative", att.body?.stats?.attempts === 1);
  const st = await api("GET", `/quizzes/${code}/stats`);
  check("GET /stats -> attempts=1", st.status === 200 && st.body?.attempts === 1);
  check("averageScore ~ 66.7", proche(st.body.averageScore, 66.7, 0.2), String(st.body?.averageScore));

  section("Quiz : suppression puis 404");
  const suppQuiz = await api("DELETE", `/quizzes/${code}`, { ownerKey });
  check("DELETE /quizzes/:code -> 204", suppQuiz.status === 204, `status ${suppQuiz.status}`);
  const introuvable = await api("GET", `/quizzes/${code}`);
  check("GET après suppression -> 404", introuvable.status === 404, `status ${introuvable.status}`);

  // ═══════════════════════════ COURS ══════════════════════════════════════
  section("Cours : création + déduplication par empreinte");
  const texteCours = "Les lois de Newton décrivent le mouvement des corps. ".repeat(6);
  const crCours = await api("POST", "/courses", { body: { title: "Mécanique", text: texteCours, language: "fr", storeText: false } });
  check("POST /courses -> 201", crCours.status === 201, `status ${crCours.status}`);
  const codeCours = crCours.body.code;
  const ownerCours = crCours.body.ownerKey;

  const reCreation = await api("POST", "/courses", { body: { title: "Autre titre", text: texteCours, language: "fr" } });
  check("même texte -> 200 (existant)", reCreation.status === 200, `status ${reCreation.status}`);
  check("même code renvoyé", reCreation.body?.code === codeCours, `${reCreation.body?.code} vs ${codeCours}`);

  section("Cours : texte stocké réservé au propriétaire");
  const crStocke = await api("POST", "/courses", {
    body: { title: "Avec texte", text: "Contenu de cours conservé sur le serveur. ".repeat(5), language: "fr", storeText: true },
  });
  check("POST /courses (storeText) -> 201", crStocke.status === 201, `status ${crStocke.status}`);
  const sansCleTexte = await api("GET", `/courses/${crStocke.body.code}`);
  check("GET sans clé : hasStoredText=true mais text=null",
    sansCleTexte.body?.hasStoredText === true && sansCleTexte.body?.text === null);
  const avecCleTexte = await api("GET", `/courses/${crStocke.body.code}`, { ownerKey: crStocke.body.ownerKey });
  check("GET avec la bonne clé : text présent",
    typeof avecCleTexte.body?.text === "string" && avecCleTexte.body.text.length > 0);

  section("Cours : rattachement de deux quiz (clé du cours requise)");
  const attachSansCle = await api("POST", "/quizzes", { body: corpsQuiz(codeCours) });
  check("rattacher sans la clé du cours -> 403", attachSansCle.status === 403, `status ${attachSansCle.status}`);
  const qA = await api("POST", "/quizzes", { body: corpsQuiz(codeCours), ownerKey: ownerCours });
  const qB = await api("POST", "/quizzes", { body: corpsQuiz(codeCours), ownerKey: ownerCours });
  check("deux quiz rattachés (avec la clé) -> 201", qA.status === 201 && qB.status === 201);
  const detail1 = await api("GET", `/courses/${codeCours}`);
  check("GET /courses/:code liste 2 quiz", detail1.body?.quizzes?.length === 2, String(detail1.body?.quizzes?.length));
  check("score null avant toute tentative", detail1.body?.score === null && detail1.body?.displayedScore === null);

  section("Cours : évolution du score sur trois tentatives");
  await api("POST", `/quizzes/${qA.body.code}/attempts`, { body: { score: 8, total: 10 } }); // -> 80
  await api("POST", `/quizzes/${qA.body.code}/attempts`, { body: { score: 5, total: 10 } }); // -> 62
  await api("POST", `/quizzes/${qB.body.code}/attempts`, { body: { score: 10, total: 10 } }); // -> 84.8
  const detail2 = await api("GET", `/courses/${codeCours}`);
  check("score du cours ~ 84.8 après 3 tentatives", proche(detail2.body?.score, 84.8, 0.2), String(detail2.body?.score));
  check("historique = 3 tentatives", detail2.body?.attempts?.length === 3, String(detail2.body?.attempts?.length));

  section("Cours : décroissance affichée (date antérieure simulée)");
  // On recule la dernière tentative de 14 jours (accès direct au repository).
  const il14jours = Date.now() - 14 * 24 * 60 * 60 * 1000;
  repo.majScoreCours(codeCours, detail2.body.score, il14jours);
  const detail3 = await api("GET", `/courses/${codeCours}`);
  check("displayedScore < score après 14 jours",
    detail3.body.displayedScore < detail3.body.score, `${detail3.body.displayedScore} vs ${detail3.body.score}`);
  check("displayedScore ~ score/e", proche(detail3.body.displayedScore, detail3.body.score / Math.E, 0.6),
    String(detail3.body.displayedScore));

  section("Cours : suppression en cascade");
  const sansCleCours = await api("DELETE", `/courses/${codeCours}`);
  check("DELETE cours sans clé -> 403", sansCleCours.status === 403, `status ${sansCleCours.status}`);
  const suppCours = await api("DELETE", `/courses/${codeCours}`, { ownerKey: ownerCours });
  check("DELETE /courses/:code -> 204", suppCours.status === 204, `status ${suppCours.status}`);
  const coursIntrouvable = await api("GET", `/courses/${codeCours}`);
  check("GET cours après suppression -> 404", coursIntrouvable.status === 404, `status ${coursIntrouvable.status}`);
  const quizCascade = await api("GET", `/quizzes/${qA.body.code}`);
  check("quiz rattaché supprimé en cascade -> 404", quizCascade.status === 404, `status ${quizCascade.status}`);
} catch (err) {
  echecs++;
  console.error("\n[test-crud] Exception inattendue :", err);
} finally {
  // Ferme le serveur ET les connexions keep-alive (undici), sinon la boucle
  // d'événements reste vivante et un process.exit() abrupt déclenche une
  // assertion libuv sous Windows.
  server.closeAllConnections?.();
  server.close();
}

// ── Résumé ────────────────────────────────────────────────────────────────
console.log(`\n══ Résumé : ${reussis} réussis, ${echecs} échoués ══`);
process.exitCode = echecs === 0 ? 0 : 1;
// Filet de sécurité : force la sortie si des sockets tardent à se libérer.
setTimeout(() => process.exit(process.exitCode), 300).unref();
