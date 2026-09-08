/**
 * server.js — Démarrage du serveur Express.
 *
 * COUCHE : point d'entrée backend (composition root serveur).
 * RÔLE : configurer Express, servir le front statique (/public), monter les
 * routes, exposer /health, puis écouter le port.
 *
 * ARCHITECTURE (MVC côté serveur) :
 *   routes -> controllers -> services. Les routes ne portent pas de logique ;
 *   les controllers orchestrent ; les services portent la logique (LLM,
 *   validation, quotas). Le contrat d'échange est figé dans /docs/contract.md.
 */

import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// __dirname n'existe pas nativement en module ES : on le reconstruit.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Le fichier .env vit dans /server (à côté de .env.example) : on le charge avec
// un chemin EXPLICITE, quel que soit le répertoire de lancement du serveur.
dotenv.config({ path: path.join(__dirname, ".env") });

// Import DYNAMIQUE du routeur : il doit être évalué APRÈS dotenv.config(), car
// certains modules de la chaîne (ex. quota.service.js) lisent process.env dès
// leur chargement. Un import statique serait hoisté et s'exécuterait AVANT la
// ligne ci-dessus, donc avant que le .env ne soit chargé.
const { default: quizRouter } = await import("./routes/quiz.routes.js");

/**
 * Construit et configure l'application Express (sans l'écouter).
 * Séparé de start() pour pouvoir être importé dans des tests.
 * @returns {import("express").Express} L'application configurée.
 */
export function createApp() {
  const app = express();

  // CORS : on n'autorise que le développement local pour l'instant.
  // (Quand le front sera déployé, on ajoutera son origine ici.)
  const originsAutorisees = [
    /^http:\/\/localhost(:\d+)?$/,
    /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  ];
  app.use(
    cors({
      origin(origin, callback) {
        // Pas d'en-tête Origin (ex. curl, script Node) -> on laisse passer.
        if (!origin) return callback(null, true);
        const autorise = originsAutorisees.some((re) => re.test(origin));
        return callback(null, autorise);
      },
    })
  );

  // Corps JSON limité à 250 ko (première barrière anti-abus, avant limits.js).
  app.use(express.json({ limit: "250kb" }));

  // Front statique.
  app.use(express.static(path.join(__dirname, "..", "public")));

  // Sonde de santé : utile pour le script de test et le monitoring.
  app.get("/health", (req, res) => {
    res.json({ ok: true });
  });

  // Routes métier (POST /generate-quiz).
  app.use("/", quizRouter);

  // Gestionnaire d'erreurs final : renvoie un format d'erreur homogène.
  // Traite notamment le cas d'un JSON illisible (express.json -> 400).
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === "entity.too.large") {
      return res.status(413).json({ error: "TEXT_TOO_LONG" });
    }
    if (err.type === "entity.parse.failed") {
      return res.status(400).json({ error: "INVALID_JSON" });
    }
    console.error("[server] Erreur non gérée :", err.message);
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  });

  return app;
}

/**
 * Démarre l'écoute HTTP.
 * @returns {void}
 */
function start() {
  const port = process.env.PORT || 3000;

  // Avertissement de sécurité si le code d'accès n'est pas configuré :
  // dans ce cas accessCode.js laisse passer toutes les requêtes (mode dev).
  if (!process.env.ACCESS_CODE) {
    console.warn(
      "[server] ATTENTION : ACCESS_CODE non défini — le contrôle du code d'accès est DÉSACTIVÉ (mode développement)."
    );
  }

  createApp().listen(port, () => {
    console.log(`[server] En écoute sur http://localhost:${port}`);
  });
}

// Démarrage uniquement si le fichier est exécuté directement
// (et pas seulement importé par un test).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  start();
}
