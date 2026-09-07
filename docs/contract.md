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
  "count": "number — nombre de questions demandées (optionnel)"
}
```

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
- `questions[].source_page` et `flashcards[].source_page` sont des entiers ≥ 1.
- **`source_excerpt` DOIT exister réellement dans le texte source** transmis
  dans la requête (vérification anti-hallucination côté serveur).

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
