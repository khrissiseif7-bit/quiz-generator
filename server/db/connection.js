/**
 * connection.js — Ouverture de la base SQLite et application du schéma.
 *
 * COUCHE : Infrastructure (serveur). Utilise le module NATIF `node:sqlite`
 * (Node 22+/24 : DatabaseSync), donc AUCUNE dépendance à installer.
 *
 * RÔLE :
 *   - créer le dossier server/data/ si besoin ;
 *   - ouvrir server/data/quiz.db ;
 *   - activer les clés étrangères (PRAGMA foreign_keys = ON) — indispensable à
 *     CHAQUE ouverture SQLite pour que les cascades ON DELETE fonctionnent ;
 *   - appliquer le schéma (CREATE TABLE IF NOT EXISTS) ;
 *   - exporter l'instance partagée `db`.
 *
 * Si `node:sqlite` n'est pas disponible, on échoue TÔT avec un message explicite
 * (le projet exige Node 22+). On ne bascule PAS silencieusement sur un autre
 * moteur.
 */

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Emplacement du fichier de base : server/data/quiz.db (dossier ignoré par git).
// Surchargable par DB_PATH (utile pour les tests : base isolée, ou :memory:).
const cheminParDefaut = path.join(__dirname, "..", "data", "quiz.db");
const cheminBase = process.env.DB_PATH || cheminParDefaut;

// Crée le dossier parent si nécessaire (sauf pour une base en mémoire).
if (cheminBase !== ":memory:") {
  fs.mkdirSync(path.dirname(cheminBase), { recursive: true });
}

/** Instance SQLite partagée par tout le serveur. */
export const db = new DatabaseSync(cheminBase);

// Clés étrangères + cascades : à activer explicitement à chaque ouverture.
db.exec("PRAGMA foreign_keys = ON;");

// Application du schéma (idempotent grâce à IF NOT EXISTS).
const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
db.exec(schema);

export default db;
