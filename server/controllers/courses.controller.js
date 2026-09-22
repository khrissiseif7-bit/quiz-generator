/**
 * courses.controller.js — Controllers du CRUD REST des cours.
 *
 * COUCHE : Controller (serveur).
 * RÔLE : regrouper les quiz d'un même document, suivre le score de révision, et
 * décider si le TEXTE du cours est conservé.
 *
 * PRINCIPE DIRECTEUR : le texte du cours n'est JAMAIS conservé par défaut. Il
 * n'est stocké (courses.text) que si l'utilisateur coche « conserver le texte ».
 * Le serveur reçoit le texte pour calculer son EMPREINTE (déduplication d'un
 * même document re-déposé), mais ne le PERSISTE que sur choix explicite.
 */

import * as repo from "../services/quiz.repository.js";
import { genererCleProprietaire, hacher, empreinteTexte } from "../services/security.service.js";
import { scoreAffiche, joursDepuis } from "../services/score.service.js";

const LANGUES_OK = ["fr", "ar", "en"];

/** Réponse 400 homogène. */
function erreurValidation(res, errors) {
  return res.status(400).json({ error: "VALIDATION_ERROR", details: errors });
}

/**
 * POST /courses — crée un cours, ou renvoie le cours EXISTANT si le même texte
 * (même empreinte) est déjà connu. 201 { code, ownerKey } sinon 200 { code, existing }.
 */
export function creerCours(req, res) {
  const body = req.body || {};
  const errors = [];
  if (typeof body.text !== "string" || body.text.trim().length === 0) {
    errors.push({ field: "text", code: "REQUIRED" });
  }
  if (!LANGUES_OK.includes(body.language)) {
    errors.push({ field: "language", code: "INVALID_VALUE" });
  }
  if (errors.length) return erreurValidation(res, errors);

  const textHash = empreinteTexte(body.text);

  // Déduplication : même document déjà enregistré -> on renvoie l'existant.
  const existant = repo.lireCoursParHash(textHash);
  if (existant) {
    return res.status(200).json({
      code: existant.code,
      title: existant.title,
      language: existant.language,
      existing: true, // la clé propriétaire n'est PAS renvoyée (déjà connue du client)
    });
  }

  const code = repo.nouveauCodeCours();
  const ownerKey = genererCleProprietaire();
  const conserverTexte = body.storeText === true;

  repo.creerCours({
    code,
    title: (typeof body.title === "string" && body.title.trim()) || titreParDefaut(body.text),
    textHash,
    textLength: body.text.length,
    text: conserverTexte ? body.text : null, // stocké UNIQUEMENT si demandé
    language: body.language,
    createdAt: Date.now(),
    ownerKeyHash: hacher(ownerKey),
  });

  return res.status(201).json({ code, ownerKey });
}

/**
 * GET /courses/:code — cours + quiz + tentatives + score et displayedScore.
 * Le texte stocké est renvoyé (pour « Réviser » en génération directe) ; il est
 * null si l'utilisateur n'a pas choisi de le conserver.
 */
export function lireCours(req, res) {
  const cours = repo.lireCours(req.params.code);
  if (!cours) return res.status(404).json({ error: "NOT_FOUND" });

  // Le TEXTE stocké n'est renvoyé qu'au propriétaire (bonne X-Owner-Key). Sans
  // clé, le cours est renvoyé sans son texte (mais `hasStoredText` indique
  // qu'un texte existe, pour que le front sache si « Réviser » est direct).
  const cle = req.headers["x-owner-key"];
  const estProprietaire = !!cle && hacher(cle) === cours.owner_key_hash;

  const jours = joursDepuis(cours.last_attempt_at || 0);
  return res.json({
    code: cours.code,
    title: cours.title,
    language: cours.language,
    text_length: cours.text_length,
    hasStoredText: cours.text != null,
    isOwner: estProprietaire,
    text: estProprietaire ? cours.text : null, // texte réservé au propriétaire
    score: cours.score,
    displayedScore: scoreAffiche(cours.score, jours),
    last_attempt_at: cours.last_attempt_at,
    created_at: cours.created_at,
    quizzes: repo.quizDuCours(cours.code),
    attempts: repo.tentativesDuCours(cours.code),
  });
}

/**
 * PUT /courses/:code — titre + activer/désactiver le stockage du texte
 * (clé propriétaire requise).
 */
export function majCours(req, res) {
  const cours = repo.lireCours(req.params.code); // existence déjà garantie par le middleware
  const body = req.body || {};

  const titre = (typeof body.title === "string" && body.title.trim()) || cours.title;

  // Gestion du stockage du texte :
  //   storeText === true  -> on conserve le texte (fourni, ou celui déjà stocké) ;
  //   storeText === false -> on efface le texte stocké ;
  //   storeText absent    -> inchangé.
  let texte = cours.text;
  if (body.storeText === true) {
    texte = typeof body.text === "string" && body.text.length ? body.text : cours.text;
    if (texte == null) {
      return erreurValidation(res, [{ field: "text", code: "REQUIRED" }]); // rien à conserver
    }
  } else if (body.storeText === false) {
    texte = null;
  }

  repo.majCours(cours.code, titre, texte);
  return res.json({ code: cours.code, title: titre, hasStoredText: texte != null });
}

/**
 * DELETE /courses/:code — supprime cours, quiz, questions, flashcards et
 * tentatives en cascade (clé propriétaire requise).
 */
export function supprimerCours(req, res) {
  repo.supprimerCours(req.params.code);
  return res.status(204).end();
}

/** Titre par défaut : première ligne non vide du cours, tronquée. */
function titreParDefaut(texte) {
  const premiere = texte.split("\n").map((l) => l.trim()).find((l) => l.length > 0) || "Cours";
  return premiere.slice(0, 80);
}
