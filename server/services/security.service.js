/**
 * security.service.js — Génération de codes/clés et empreintes (hash).
 *
 * COUCHE : Service (serveur), sans SQL ni réseau.
 * RÔLE :
 *   - générer un CODE lisible (6 caractères, alphabet sans ambiguïté) ;
 *   - générer une CLÉ PROPRIÉTAIRE (32 caractères aléatoires) ;
 *   - hacher une valeur en SHA-256 (on ne stocke JAMAIS la clé en clair) ;
 *   - calculer l'EMPREINTE d'un texte de cours (normalisé) pour reconnaître un
 *     même document re-déposé.
 *
 * L'unicité du code est vérifiée par le repository (qui seul connaît la base).
 */

import crypto from "node:crypto";

// Alphabet sans caractères ambigus : ni 0/O, ni 1/I/L. Facile à lire et à dicter.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * Génère un code de 6 caractères tirés de l'alphabet non ambigu.
 * (L'unicité en base est vérifiée par l'appelant, qui retire au besoin.)
 * @returns {string} Ex. « 7KQF3M ».
 */
export function genererCode() {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[crypto.randomInt(ALPHABET.length)];
  }
  return code;
}

/**
 * Génère une clé propriétaire de 32 caractères hexadécimaux (16 octets).
 * Renvoyée UNE SEULE FOIS au client à la création ; jamais restockée en clair.
 * @returns {string}
 */
export function genererCleProprietaire() {
  return crypto.randomBytes(16).toString("hex"); // 16 octets -> 32 caractères hex
}

/**
 * Hache une valeur en SHA-256 (hexadécimal). Sert à comparer une clé fournie
 * (X-Owner-Key) au hash stocké, sans jamais conserver la clé en clair.
 * @param {string} valeur
 * @returns {string} Hash hexadécimal (64 caractères).
 */
export function hacher(valeur) {
  return crypto.createHash("sha256").update(String(valeur)).digest("hex");
}

/**
 * Normalise un texte de cours pour l'empreinte : minuscules + espaces réduits.
 * Objectif : qu'un même document re-déposé (petites variations d'espaces, casse)
 * produise la MÊME empreinte, donc soit reconnu comme le même cours.
 * @param {string} texte
 * @returns {string}
 */
export function normaliserTexte(texte) {
  return String(texte).toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Empreinte SHA-256 du texte normalisé d'un cours (pour la déduplication).
 * @param {string} texte
 * @returns {string} Hash hexadécimal.
 */
export function empreinteTexte(texte) {
  return hacher(normaliserTexte(texte));
}
