/**
 * llm.service.js — Détection de langue, construction du prompt et appel au LLM.
 *
 * COUCHE : Service (serveur).
 *
 * ┌── PROVIDER ISOLÉ ──────────────────────────────────────────────────────┐
 * │ Le fournisseur actuel est Google Gemini (modèle Flash, palier gratuit), │
 * │ appelé via son API REST avec `fetch` natif — aucun SDK.                 │
 * │ POUR CHANGER DE FOURNISSEUR : il suffit de réécrire la SEULE fonction   │
 * │ `callLLM()` ci-dessous (URL, en-têtes, forme du corps, extraction du    │
 * │ texte de réponse). `detectLanguage()` et `buildPrompt()` sont           │
 * │ indépendants du fournisseur.                                            │
 * └────────────────────────────────────────────────────────────────────────┘
 *
 * Variables d'environnement utilisées : LLM_PROVIDER, LLM_API_KEY, LLM_MODEL.
 */

import frPrompt from "../config/prompts/fr.js";
import arPrompt from "../config/prompts/ar.js";
import enPrompt from "../config/prompts/en.js";

// Table langue -> gabarit de prompt.
const GABARITS = { fr: frPrompt, ar: arPrompt, en: enPrompt };

// Mots vides (stop words) servant à départager français et anglais.
const MOTS_VIDES_FR = ["le", "la", "les", "de", "des", "un", "une", "et", "est",
  "en", "que", "pour", "dans", "qui", "ne", "pas", "plus", "sur", "au", "du", "ce", "sont"];
const MOTS_VIDES_EN = ["the", "of", "and", "to", "in", "a", "is", "that", "it",
  "for", "on", "as", "with", "are", "be", "this", "by", "an", "or", "from", "at"];

/**
 * Indique si le mode diagnostic est actif (variable d'environnement DEBUG_LLM=true).
 * @returns {boolean}
 */
function debugActif() {
  return process.env.DEBUG_LLM === "true";
}

// Modèle Flash par défaut si LLM_MODEL n'est pas défini dans l'environnement.
// Choisi car stable et rapide sur le palier gratuit (le « recommandé »
// gemini-3.6-flash est fréquemment saturé, et gemini-2.5-flash est retiré).
const MODELE_DEFAUT = "gemini-3.5-flash";

// Modèles Flash de repli, essayés DANS CET ORDRE si le modèle courant est
// retiré (404) ou saturé (503). Tous vérifiés comme répondant (HTTP 200).
// Permet de survivre au retrait/à la saturation d'un modèle sans modifier le .env.
const MODELES_REPLI = [
  "gemini-3.5-flash",
  "gemini-3.7-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash-lite",
];

// Cache mémoire du dernier modèle ayant répondu (évite de resonder à chaque appel).
let modeleValideMemoire = null;

/**
 * Détecte la langue dominante d'un texte : 'ar', 'fr' ou 'en'.
 * Heuristique simple, sans dépendance externe.
 * @param {string} text - Texte source à analyser.
 * @returns {"fr"|"ar"|"en"} Code langue détecté.
 */
export function detectLanguage(text) {
  // 1) Arabe : si plus de 15 % des lettres sont dans la plage arabe -> 'ar'.
  const lettres = text.replace(/[^\p{L}]/gu, ""); // on ne garde que les lettres
  const arabes = text.match(/[؀-ۿ]/g) || [];
  if (lettres.length > 0 && arabes.length / lettres.length > 0.15) {
    return "ar";
  }

  // 2) Français vs anglais : on compte les mots vides de chaque langue.
  const mots = text.toLowerCase().match(/[a-zàâäéèêëïîôöùûüç]+/g) || [];
  let scoreFr = 0;
  let scoreEn = 0;
  for (const mot of mots) {
    if (MOTS_VIDES_FR.includes(mot)) scoreFr++;
    if (MOTS_VIDES_EN.includes(mot)) scoreEn++;
  }
  // En cas d'égalité (texte très court/neutre), on retombe sur le français.
  return scoreEn > scoreFr ? "en" : "fr";
}

/**
 * Construit le prompt final à partir du gabarit de la langue voulue.
 * @param {{text:string, language:"fr"|"ar"|"en", difficulty:string, questionCount:number}} params
 * @returns {string} Prompt prêt à être envoyé au fournisseur.
 */
export function buildPrompt({ text, language, difficulty, questionCount }) {
  const gabarit = GABARITS[language] || GABARITS.fr;
  return gabarit({ text, difficulty, questionCount });
}

/**
 * Schéma de réponse imposé au modèle (format Gemini, types en MAJUSCULES).
 * Il reflète le contrat de /docs/contract.md et force une sortie JSON structurée.
 * @param {number} questionCount - Nombre attendu de questions/flashcards (indicatif).
 * @returns {object} responseSchema pour l'API Gemini.
 */
function schemaReponseGemini() {
  const question = {
    type: "OBJECT",
    properties: {
      id: { type: "STRING" },
      type: { type: "STRING", enum: ["mcq"] },
      difficulty: { type: "STRING", enum: ["easy", "medium", "hard"] },
      question: { type: "STRING" },
      choices: { type: "ARRAY", items: { type: "STRING" } },
      correct_index: { type: "INTEGER" },
      explanation: { type: "STRING" },
      source_excerpt: { type: "STRING" },
      source_page: { type: "INTEGER" },
    },
    required: ["id", "type", "difficulty", "question", "choices",
      "correct_index", "explanation", "source_excerpt", "source_page"],
  };

  const flashcard = {
    type: "OBJECT",
    properties: {
      id: { type: "STRING" },
      front: { type: "STRING" },
      back: { type: "STRING" },
      source_page: { type: "INTEGER" },
    },
    required: ["id", "front", "back", "source_page"],
  };

  return {
    type: "OBJECT",
    properties: {
      language: { type: "STRING", enum: ["fr", "ar", "en"] },
      title: { type: "STRING" },
      questions: { type: "ARRAY", items: question },
      flashcards: { type: "ARRAY", items: flashcard },
    },
    required: ["language", "title", "questions", "flashcards"],
  };
}

/**
 * Appelle le fournisseur LLM et renvoie l'objet quiz brut (non validé).
 *
 * >>> SEULE FONCTION À RÉÉCRIRE POUR CHANGER DE FOURNISSEUR <<<
 *
 * @param {string} prompt - Prompt complet à envoyer.
 * @param {{temperature?:number}} [options] - Réglages d'appel (température).
 * @returns {Promise<object>} Objet JSON renvoyé par le modèle (au format contrat).
 * @throws {Error} avec err.code = 'LLM_UNAVAILABLE' si l'appel échoue (réseau,
 *          modèle indisponible, réponse illisible). Ce code est DISTINCT de
 *          'GENERATION_FAILED', réservé au cas « trop de questions rejetées ».
 */
export async function callLLM(prompt, options = {}) {
  const { temperature = 0.3 } = options;

  const provider = process.env.LLM_PROVIDER || "gemini";
  const apiKey = process.env.LLM_API_KEY;
  const modeleConfig = process.env.LLM_MODEL || MODELE_DEFAUT;

  if (provider !== "gemini") {
    // Garde-fou : ce service n'implémente que Gemini pour l'instant.
    throw erreurIndispo(`Fournisseur non supporté : ${provider}`);
  }
  if (!apiKey) {
    throw erreurIndispo("LLM_API_KEY manquante dans l'environnement.");
  }

  const corps = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      responseMimeType: "application/json",
      responseSchema: schemaReponseGemini(),
    },
  };

  // Ordre d'essai : modèle déjà validé lors d'un appel précédent (cache), puis
  // modèle configuré, puis modèles de repli. On ne bascule vers le repli QUE si
  // le modèle est introuvable/retiré (404) — jamais pour une erreur d'auth/quota.
  const candidats = [];
  const ajouter = (m) => { if (m && !candidats.includes(m)) candidats.push(m); };
  ajouter(modeleValideMemoire);
  ajouter(modeleConfig);
  for (const m of MODELES_REPLI) ajouter(m);

  let derniereErreur = null;
  for (const model of candidats) {
    const essai = await tenterModele(model, corps);
    if (essai.ok) {
      // On mémorise le modèle qui répond et on prévient en cas de bascule.
      if (modeleValideMemoire !== model) {
        modeleValideMemoire = model;
        if (model !== modeleConfig) {
          console.warn(
            `[llm] Modèle « ${modeleConfig} » indisponible — bascule automatique sur « ${model} ». Pense à mettre à jour LLM_MODEL dans server/.env.`
          );
        }
      }
      return essai.data;
    }
    derniereErreur = essai;
    // Erreur autre qu'un modèle retiré : inutile d'essayer les autres modèles.
    if (!essai.modeleIntrouvable) break;
  }

  throw erreurIndispo(derniereErreur?.message || "Appel Gemini échoué (aucun modèle disponible).");
}

/**
 * Tente UN appel generateContent avec un modèle donné (timeout 60 s).
 * @param {string} model - Nom du modèle Gemini.
 * @param {object} corps - Corps de la requête (contents + generationConfig).
 * @returns {Promise<{ok:true, data:object} | {ok:false, modeleIntrouvable:boolean, message:string}>}
 */
async function tenterModele(model, corps) {
  const apiKey = process.env.LLM_API_KEY;
  // NB : la clé est en query string — on ne loggue JAMAIS l'URL.
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const controleur = new AbortController();
  // 120 s : les textes longs (jusqu'à ~30 000 caractères) peuvent demander
  // 25–40 s, davantage sous charge ; 60 s était trop juste et causait des 502.
  const minuteur = setTimeout(() => controleur.abort(), 120000);

  let reponse;
  try {
    reponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
      signal: controleur.signal,
    });
  } catch (err) {
    // Inclut le timeout (AbortError).
    if (debugActif()) console.log(`[llm][debug] Échec réseau (${model}) : ${err.message}`);
    return { ok: false, modeleIntrouvable: false, message: `réseau: ${err.message}` };
  } finally {
    clearTimeout(minuteur);
  }

  if (!reponse.ok) {
    let corpsErreur = "";
    try { corpsErreur = await reponse.text(); } catch { corpsErreur = "(corps illisible)"; }
    if (debugActif()) {
      console.log(`[llm][debug] Gemini a répondu HTTP ${reponse.status} (${model}) — corps (500 c) :\n${corpsErreur.slice(0, 500)}`);
    }
    // On bascule sur un autre modèle si celui-ci est retiré (404) ou saturé (503).
    // Les autres erreurs (401 auth, 429 quota, 400 requête) NE déclenchent pas de
    // repli : elles concerneraient tous les modèles de la même clé.
    const basculer =
      reponse.status === 404 ||
      reponse.status === 503 ||
      /not[_ ]?found|no longer available|high demand/i.test(corpsErreur);
    return { ok: false, modeleIntrouvable: basculer, message: `HTTP ${reponse.status}` };
  }

  const donnees = await reponse.json();

  // Extraction du texte : Gemini renvoie le JSON dans candidates[0].content.parts[0].text.
  const texteJson = donnees?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!texteJson) {
    if (debugActif()) {
      console.log(`[llm][debug] Réponse sans texte exploitable (${model}) — aperçu (500 c) :\n${JSON.stringify(donnees).slice(0, 500)}`);
    }
    return { ok: false, modeleIntrouvable: false, message: "réponse vide/inattendue" };
  }

  try {
    return { ok: true, data: JSON.parse(texteJson) };
  } catch {
    if (debugActif()) {
      console.log(`[llm][debug] JSON illisible (${model}) — début du texte brut reçu (500 c) :\n${texteJson.slice(0, 500)}`);
    }
    return { ok: false, modeleIntrouvable: false, message: "JSON illisible" };
  }
}

/**
 * Fabrique une erreur d'INDISPONIBILITÉ du fournisseur (réseau/API/modèle),
 * que le controller traduit en 502 LLM_UNAVAILABLE. À distinguer de
 * GENERATION_FAILED (validation : trop de questions rejetées).
 * @param {string} message - Détail technique (pour les logs).
 * @returns {Error} Erreur portant le code 'LLM_UNAVAILABLE'.
 */
function erreurIndispo(message) {
  const err = new Error(message);
  err.code = "LLM_UNAVAILABLE";
  return err;
}
