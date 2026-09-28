# Contrat d'échange front ↔ back

Ce document **fige** le format d'échange entre le front (public/) et le back
(server/). **Aucune couche ne doit le contredire.** Toute évolution du format
doit d'abord être modifiée ici, puis répercutée dans :

- `public/js/services/Validator.js` (validation côté client)
- `server/services/validation.service.js` (validation côté serveur)

---

## Requête : `POST /generate-quiz`

En-têtes :

| En-tête          | Valeur                        | Obligatoire |
|------------------|-------------------------------|-------------|
| `Content-Type`   | `application/json`            | oui         |
| `X-Access-Code`  | code d'accès (voir `.env`)    | oui         |

Corps (JSON) :

```json
{
  "text": "string — texte source du cours (obligatoire)",
  "language": "fr | ar | en — langue demandée (optionnel, sinon détectée)",
  "difficulty": "easy | medium | hard — difficulté cible (optionnel)",
  "count": "number — nombre de questions demandées (optionnel)",
  "source": "pdf | text — origine du texte (optionnel, défaut \"text\")"
}
```

- `source` = `"pdf"` : le texte provient d'un PDF paginé → le modèle fournit un
  `source_page` (entier ≥ 1) pour chaque question/flashcard.
- `source` = `"text"` (ou absent) : texte **collé**, sans pagination → aucun
  numéro de page n'est demandé et `source_page` est **forcé à `null`** côté
  serveur (pas de numéro inventé, aucun numéro affiché côté front).

---

## Réponse : `200 OK`

Le corps de la réponse respecte **strictement** le schéma suivant :

```json
{
  "language": "fr | ar | en",
  "title": "string",
  "questions": [
    {
      "id": "string",
      "type": "mcq",
      "difficulty": "easy | medium | hard",
      "question": "string",
      "choices": ["string", "string", "string", "string"],
      "correct_index": 0,
      "explanation": "string",
      "source_excerpt": "string",
      "source_page": 1
    }
  ],
  "flashcards": [
    {
      "id": "string",
      "front": "string",
      "back": "string",
      "source_page": 1
    }
  ]
}
```

### Règles de validation

- `language` ∈ { `"fr"`, `"ar"`, `"en"` }.
- `questions[].type` vaut toujours `"mcq"`.
- `questions[].difficulty` ∈ { `"easy"`, `"medium"`, `"hard"` }.
- `questions[].choices` contient **exactement 4** chaînes non vides.
- `questions[].correct_index` est un entier de **0 à 3** inclus.
- `questions[].source_page` et `flashcards[].source_page` sont des entiers ≥ 1
  **si `source = "pdf"`** ; ils valent **`null`** si `source = "text"` (texte
  collé, sans pagination).
- **`source_excerpt` DOIT exister réellement dans le texte source** transmis
  dans la requête (vérification anti-hallucination côté serveur).
- **`explanation` ne doit désigner aucune proposition par sa lettre, son numéro
  ou sa position** (les propositions sont mélangées à l'affichage). Une telle
  référence entraîne le rejet de la question côté serveur (motif interne
  `EXPLANATION_POSITIONAL`) : l'explication doit désigner une proposition par
  son **contenu**.

---

## Codes d'erreur

| Code  | Signification                              | Émis par                     |
|-------|--------------------------------------------|------------------------------|
| `401` | Code d'accès manquant ou invalide          | `middlewares/accessCode.js`  |
| `413` | Corps ou texte trop volumineux             | `middlewares/limits.js`      |
| `429` | Quota dépassé (par IP ou global journalier)| `services/quota.service.js`  |
| `502` | Erreur ou réponse invalide du provider LLM | `services/llm.service.js`    |

Format d'une erreur :

```json
{ "error": { "code": 429, "message": "string" } }
```

---

# Contrat REST — persistance (quiz, questions, tentatives, cours)

> **PRINCIPE DIRECTEUR : on stocke le QUIZ, jamais le texte du cours.**
> Le texte source n'est conservé (`courses.text`) que si l'utilisateur coche
> explicitement « conserver le texte ». Les quiz et questions ne portent aucun
> texte de cours (seulement `source_length` et l'extrait cité `source_excerpt`).

Persistance en **SQLite** via le module natif `node:sqlite` (Node 22+, aucune
dépendance). L'en-tête **`X-Access-Code`** est requis sur les **écritures**
(POST/PUT/DELETE) et sur la génération, mais **pas** sur les **lectures** (GET :
`/quizzes/:code`, `/quizzes/:code/stats`, `/courses/:code`) — elles ne consomment
aucun quota LLM et restent protégées par le code de la ressource (6 caractères
non devinables). Le champ `text` d'un cours reste réservé à la bonne `X-Owner-Key`.

## Sécurité sans compte

- **`code`** : identifiant public de 6 caractères, alphabet sans ambiguïté
  (ni `0/O`, ni `1/I/L`). Unicité vérifiée en base.
- **`ownerKey`** : clé propriétaire de 32 caractères, renvoyée **UNE seule fois**
  à la création. Stockée en base **uniquement sous forme de hash SHA-256**.
  Fournie via l'en-tête **`X-Owner-Key`** sur les écritures protégées.
- **`X-Owner-Key` requis** sur : `PUT`/`DELETE` d'un quiz, **tout** le CRUD des
  questions, `PUT`/`DELETE` d'un cours. Absente/incorrecte → `403 FORBIDDEN`.

## Codes d'erreur homogènes

| Code | `error`            | Quand                                                        |
|------|--------------------|-------------------------------------------------------------|
| 400  | `VALIDATION_ERROR` | corps invalide ; `details: [{ field, code }]`               |
| 401  | `INVALID_CODE`     | `X-Access-Code` manquant/incorrect                          |
| 403  | `FORBIDDEN`        | `X-Owner-Key` manquante/incorrecte                          |
| 404  | `NOT_FOUND`        | ressource inexistante                                        |
| 409  | `CONFLICT`         | règle métier (ex. supprimer sous 3 questions)               |
| 429  | `RATE_LIMITED`     | `POST /quizzes` > 10/h par IP ; `retryAfterSeconds`         |

## Routes — quiz

| Méthode | Route | Clé prop. | Réponse |
|---|---|:--:|---|
| `POST`   | `/quizzes` | — | `201 { code, ownerKey }` |
| `GET`    | `/quizzes/:code` | — | `200` quiz complet (sans le hash) |
| `PUT`    | `/quizzes/:code` | ✔ | `200 { code, title }` — titre uniquement |
| `DELETE` | `/quizzes/:code` | ✔ | `204` |
| `POST`   | `/quizzes/:code/questions` | ✔ | `201` question créée (`origin: "manual"`) |
| `PUT`    | `/quizzes/:code/questions/:id` | ✔ | `200` question modifiée |
| `DELETE` | `/quizzes/:code/questions/:id` | ✔ | `204` ; `409` s'il resterait < 3 questions |
| `POST`   | `/quizzes/:code/attempts` | — | `201 { attempt, stats }` |
| `GET`    | `/quizzes/:code/stats` | — | `200 { attempts, averageScore, bestScore }` |

Corps de `POST /quizzes` :

```json
{
  "title": "string",
  "language": "fr | ar | en",
  "difficulty": "easy | medium | hard",
  "source_length": 1234,
  "course_code": "string | null (facultatif)",
  "questions": [ { "question": "…", "choices": ["a","b","c","d"],
    "correct_index": 0, "explanation": "…",
    "source_excerpt": "… | null", "source_page": 1, "origin": "ai | manual" } ],
  "flashcards": [ { "front": "…", "back": "…", "source_page": 1 } ]
}
```

Corps d'une question (`POST`/`PUT .../questions`) — mêmes règles que la
génération, mais **`source_excerpt` / `source_page` facultatifs** (une question
ajoutée à la main n'a pas d'extrait) : 4 propositions **distinctes**,
`correct_index` 0..3, `explanation` non vide, formulations « toutes/aucune des
réponses » interdites.

## Routes — cours

| Méthode | Route | Clé prop. | Réponse |
|---|---|:--:|---|
| `POST`   | `/courses` | — | `201 { code, ownerKey }`, ou `200 { code, existing:true }` si le même texte (empreinte) existe déjà |
| `GET`    | `/courses/:code` | — | `200` cours + quiz + tentatives + `score` **et** `displayedScore` |
| `PUT`    | `/courses/:code` | ✔ | `200` — titre + activer/désactiver le stockage du texte |
| `DELETE` | `/courses/:code` | ✔ | `204` — cascade (quiz, questions, flashcards, tentatives) |

- **Empreinte** : `text_hash = SHA-256(texte minuscules, espaces réduits)`. Un
  même document re-déposé est reconnu (déduplication).
- **Score du cours** : à chaque tentative d'un quiz rattaché,
  `score = 0.6 × (résultat%) + 0.4 × score_précédent` (première fois : résultat brut).
- **Score affiché** : `displayedScore = score × exp(-jours / 14)`, borné à 0
  (courbe de l'oubli). Le score stocké ne décroît pas ; seule la valeur affichée baisse.
