/**
 * server.js — Démarrage du serveur Express.
 *
 * COUCHE : point d'entrée backend (composition root serveur).
 * RÔLE : configurer Express, servir le front statique (/public), monter les
 * middlewares transverses et les routes, puis écouter le port.
 *
 * ARCHITECTURE (MVC côté serveur) :
 *   routes -> controllers -> services. Les routes ne contiennent pas de logique ;
 *   les controllers orchestrent ; les services portent la logique (LLM, validation,
 *   quotas). Le contrat d'échange est figé dans /docs/contract.md.
 *
 * DÉPENDANCES PRÉVUES : express, dotenv (non installées à cette étape).
 */

// TODO: import express from "express";
// TODO: import "dotenv/config";
// TODO: import quizRoutes from "./routes/quiz.routes.js";

/**
 * Construit et configure l'application Express (sans l'écouter).
 * @returns {object} L'instance d'application Express configurée.
 */
export function createApp() {
  // TODO: const app = express();
  // TODO: servir les fichiers statiques de /public.
  // TODO: app.use(express.json({ limit: ... })) — cohérent avec limits.js.
  // TODO: monter les routes : app.use("/", quizRoutes).
  // TODO: brancher un gestionnaire d'erreurs renvoyant { error:{ code, message } }.
  // TODO: return app.
}

/**
 * Démarre l'écoute HTTP.
 * @returns {void}
 */
function start() {
  // TODO: const port = process.env.PORT || 3000;
  // TODO: createApp().listen(port, ...).
}

// TODO: start();
