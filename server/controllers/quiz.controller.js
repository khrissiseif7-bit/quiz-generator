/**
 * quiz.controller.js — Controller HTTP de génération de quiz.
 *
 * COUCHE : Controller (serveur).
 * RÔLE : orchestrer les services SANS porter leur logique interne :
 *   1. contrôle de quota (quota.service) ;
 *   2. détection de langue si 'auto' + construction du prompt + appel LLM (llm.service) ;
 *   3. validation stricte + ancrage (validation.service) ;
 *   4. si moins de 60 % des questions survivent, UN SEUL nouvel essai à
 *      température plus basse, puis 502 GENERATION_FAILED si l'échec persiste ;
 *   5. réponse au format du contrat, enrichie de meta { rejectedCount, durationMs }.
 *
 * NB : la boucle de re-génération est ICI (et non dans validation.service) pour
 * garder le service de validation PUR (sans appel réseau).
 *
 * CONFIDENTIALITÉ DES LOGS : on ne journalise JAMAIS le contenu du cours ni les
 * questions générées — uniquement des métriques agrégées.
 */

import { checkQuota } from "../services/quota.service.js";
import { detectLanguage, buildPrompt, callLLM } from "../services/llm.service.js";
import { validateQuiz, contexteAncrage } from "../services/validation.service.js";

// Seuil de survie en dessous duquel on retente la génération.
const SEUIL_SURVIE = 0.6;

/**
 * Effectue un essai complet : prompt -> LLM -> validation.
 * @param {{text:string, language:string, difficulty:string, questionCount:number}} params
 * @param {number} temperature - Température d'échantillonnage du modèle.
 * @returns {Promise<{quiz:object, resultat:{valid:object[], rejected:object[], flashcards:object[]}}>}
 */
async function essayerGeneration(params, temperature) {
  const prompt = buildPrompt(params);
  const quiz = await callLLM(prompt, { temperature });
  const resultat = validateQuiz(quiz, params.text);
  return { quiz, resultat };
}

/**
 * Agrège les motifs de rejet en compteurs (pour des logs anonymes).
 * @param {{reason:string}[]} rejected - Liste des questions rejetées.
 * @returns {Record<string, number>} Motif -> nombre d'occurrences.
 */
function compterMotifs(rejected) {
  const compteur = {};
  for (const r of rejected) {
    compteur[r.reason] = (compteur[r.reason] || 0) + 1;
  }
  return compteur;
}

/**
 * [DEBUG] Journalise le détail des rejets quand DEBUG_LLM=true :
 * décompte des motifs, puis pour les 2 premières questions rejetées, le motif,
 * le source_excerpt renvoyé, et ~200 caractères du texte source autour de la
 * meilleure correspondance trouvée. N'affecte pas le comportement.
 * @param {{valid:object[], rejected:{reason:string, question:object}[]}} resultat
 * @param {string} text - Texte source.
 * @returns {void}
 */
function debugRejets(resultat, text) {
  if (process.env.DEBUG_LLM !== "true") return;
  console.log("[quiz][debug] questions valides:", resultat.valid.length,
    "| rejetées:", resultat.rejected.length,
    "| motifs:", compterMotifs(resultat.rejected));
  for (const r of resultat.rejected.slice(0, 2)) {
    const extrait = r.question?.source_excerpt || "";
    const ctx = contexteAncrage(extrait, text);
    console.log("[quiz][debug] --- rejet ---");
    console.log("[quiz][debug] motif:", r.reason);
    console.log("[quiz][debug] source_excerpt:", JSON.stringify(extrait));
    console.log("[quiz][debug] meilleur ratio d'ancrage:", ctx.ratio.toFixed(2));
    console.log("[quiz][debug] contexte source (~200 c):", JSON.stringify(ctx.snippet));
  }
}

/**
 * Handler de `POST /generate-quiz`.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {Promise<void>}
 */
export async function generate(req, res, next) {
  const debut = Date.now();

  // 1) Quota (par IP + global journalier).
  const quota = checkQuota(req.ip);
  if (!quota.allowed) {
    const corps = { error: quota.error };
    if (quota.retryAfterSeconds != null) corps.retryAfterSeconds = quota.retryAfterSeconds;
    return res.status(quota.statusCode).json(corps);
  }

  // 2) Paramètres (déjà validés par le middleware limits.js).
  const { text, difficulty } = req.body;
  const questionCount = Number(req.body.questionCount);
  const langue = req.body.language === "auto"
    ? detectLanguage(text)
    : req.body.language;

  const params = { text, language: langue, difficulty, questionCount };

  try {
    // 3) Premier essai à température normale.
    let courant = await essayerGeneration(params, 0.3);
    debugRejets(courant.resultat, text);

    // 4) Retente une seule fois, plus déterministe, si trop peu de survivants.
    //    On CONSERVE le meilleur des deux essais : le second (température plus
    //    basse) peut être moins bon que le premier, on ne le garde que s'il fait
    //    mieux — ça évite d'échouer à cause d'un mauvais second tirage.
    if (courant.resultat.valid.length / questionCount < SEUIL_SURVIE) {
      const second = await essayerGeneration(params, 0.15);
      debugRejets(second.resultat, text);
      if (second.resultat.valid.length > courant.resultat.valid.length) {
        courant = second;
      }

      if (courant.resultat.valid.length / questionCount < SEUIL_SURVIE) {
        journaliser(debut, text, langue, questionCount, courant.resultat);
        // On renvoie les motifs de rejet pour rendre l'échec diagnostiquable
        // côté client (sans exposer le contenu des questions).
        return res.status(502).json({
          error: "GENERATION_FAILED",
          meta: {
            requested: questionCount,
            valid: courant.resultat.valid.length,
            rejectedReasons: compterMotifs(courant.resultat.rejected),
          },
        });
      }
    }

    const { quiz, resultat } = courant;

    // 5) Succès : réponse conforme au contrat + meta.
    const dureeMs = Date.now() - debut;
    journaliser(debut, text, langue, questionCount, resultat);

    return res.json({
      language: langue,
      title: quiz.title,
      questions: resultat.valid,
      flashcards: resultat.flashcards,
      meta: {
        rejectedCount: resultat.rejected.length,
        durationMs: dureeMs,
      },
    });
  } catch (err) {
    // Indisponibilité du fournisseur (réseau, timeout, modèle retiré, JSON
    // illisible) -> 502 LLM_UNAVAILABLE, à distinguer de GENERATION_FAILED
    // (qui, lui, signale un taux de rejet trop élevé à la validation).
    if (err.code === "LLM_UNAVAILABLE") {
      return res.status(502).json({ error: "LLM_UNAVAILABLE" });
    }
    return next(err);
  }
}

/**
 * Journalise des métriques ANONYMES (jamais le contenu du cours ni les questions).
 * @param {number} debut - Horodatage de début (ms).
 * @param {string} text - Texte source (seule sa longueur est logguée).
 * @param {string} language - Langue effective.
 * @param {number} requested - Nombre de questions demandé.
 * @param {{valid:object[], rejected:object[]}} resultat - Résultat de validation.
 * @returns {void}
 */
function journaliser(debut, text, language, requested, resultat) {
  console.log("[quiz]", JSON.stringify({
    durationMs: Date.now() - debut,
    textLength: text.length,
    language,
    requested,
    valid: resultat.valid.length,
    rejectedReasons: compterMotifs(resultat.rejected),
  }));
}
