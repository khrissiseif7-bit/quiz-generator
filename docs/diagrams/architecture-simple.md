# Architecture générale (version simplifiée)

Vue à quatre blocs pour le rapport (schéma détaillé en annexe :
`architecture.md`). Seuls les flux principaux entre blocs sont montrés.

```mermaid
flowchart TB
    Nav["Navigateur (MVC)"]
    Back["Backend Express"]
    DB[("SQLite")]
    Gemini["Google Gemini"]

    Nav -->|"POST /generate-quiz et CRUD REST"| Back
    Back -->|"reponses JSON"| Nav
    Back -->|"texte du cours, jamais en base sauf accord"| Gemini
    Gemini -->|"quiz JSON"| Back
    Back -->|"quiz, questions, extraits cites"| DB
    DB -->|"lectures"| Back
```

Confidentialité : le texte du cours ne sort que vers Gemini pour la
génération ; la base ne conserve que le quiz, les questions et les extraits
cités — jamais le texte complet, sauf si l'utilisateur choisit de le conserver.
