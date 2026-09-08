/**
 * scripts/test-generate.js — Outil en ligne de commande de réglage du prompt.
 *
 * RÔLE : lire un fichier de cours (.txt) passé en argument, appeler la route
 * locale POST /generate-quiz, puis afficher un résumé lisible : nombre de
 * questions valides, questions rejetées et pourquoi, durée, et aperçu de la
 * première question. Ce n'est PAS un test automatisé, mais un banc d'essai
 * manuel pour affiner les gabarits de prompt.
 *
 * PRÉREQUIS : le serveur doit tourner (npm run dev) dans un autre terminal.
 *
 * USAGE :
 *   node scripts/test-generate.js <fichier.txt> [langue] [difficulté] [nbQuestions]
 * EXEMPLES :
 *   node scripts/test-generate.js test-data/cours-fr.txt
 *   node scripts/test-generate.js test-data/cours-ar.txt ar hard 10
 *
 * Le code d'accès est lu depuis server/.env (ACCESS_CODE) et envoyé dans
 * l'en-tête X-Access-Code. Sinon le serveur répond 401 INVALID_CODE.
 * BASE_URL (défaut http://localhost:3000) reste surchargeable par l'environnement.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Charge le .env du SERVEUR (server/.env) avec un chemin EXPLICITE, quel que
// soit le répertoire de lancement du script. C'est là que vit ACCESS_CODE.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", "server", ".env") });

async function main() {
  const [fichier, langue = "auto", difficulte = "medium", nb = "10"] =
    process.argv.slice(2);

  if (!fichier) {
    console.error("Usage : node scripts/test-generate.js <fichier.txt> [langue] [difficulté] [nbQuestions]");
    process.exit(1);
  }

  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  const texte = await readFile(fichier, "utf8");

  const enTetes = { "Content-Type": "application/json" };
  if (process.env.ACCESS_CODE) enTetes["X-Access-Code"] = process.env.ACCESS_CODE;

  console.log(`→ POST ${baseUrl}/generate-quiz`);
  console.log(`  fichier=${fichier} (${texte.length} caractères) langue=${langue} difficulté=${difficulte} nb=${nb}\n`);

  const debut = Date.now();
  let reponse;
  try {
    reponse = await fetch(`${baseUrl}/generate-quiz`, {
      method: "POST",
      headers: enTetes,
      body: JSON.stringify({
        text: texte,
        language: langue,
        difficulty: difficulte,
        questionCount: Number(nb),
      }),
    });
  } catch (err) {
    console.error(`✗ Impossible de joindre le serveur (${err.message}). Est-il démarré ?`);
    process.exit(1);
  }

  const dureeReseau = Date.now() - debut;
  const donnees = await reponse.json().catch(() => ({}));

  // --- Cas d'erreur ---
  if (!reponse.ok) {
    console.error(`✗ HTTP ${reponse.status} : ${donnees.error || JSON.stringify(donnees)}`);
    // En cas de GENERATION_FAILED, le serveur joint les motifs de rejet : on les
    // affiche pour comprendre pourquoi la validation a écarté trop de questions.
    if (donnees.meta) {
      console.error(`  valides ${donnees.meta.valid}/${donnees.meta.requested} — motifs de rejet : ${JSON.stringify(donnees.meta.rejectedReasons)}`);
    }
    process.exit(1);
  }

  // --- Résumé de succès ---
  const questions = donnees.questions || [];
  const meta = donnees.meta || {};

  console.log("✓ Quiz généré");
  console.log(`  titre        : ${donnees.title}`);
  console.log(`  langue       : ${donnees.language}`);
  console.log(`  questions    : ${questions.length} valides`);
  console.log(`  rejetées     : ${meta.rejectedCount ?? "?"}`);
  console.log(`  flashcards   : ${(donnees.flashcards || []).length}`);
  console.log(`  durée serveur: ${meta.durationMs ?? "?"} ms (réseau total ${dureeReseau} ms)`);

  // Aperçu de la première question.
  if (questions.length > 0) {
    const q = questions[0];
    console.log("\n— Aperçu de la première question —");
    console.log(`  Q : ${q.question}`);
    q.choices.forEach((c, i) => {
      const marque = i === q.correct_index ? "✓" : " ";
      console.log(`   [${marque}] ${i}. ${c}`);
    });
    console.log(`  Explication : ${q.explanation}`);
    console.log(`  Extrait source (p.${q.source_page}) : "${q.source_excerpt}"`);
  }
}

main().catch((err) => {
  console.error("Erreur inattendue :", err);
  process.exit(1);
});
