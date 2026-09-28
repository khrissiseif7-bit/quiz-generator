# Modèle conceptuel de données — Base SQLite

Tables réelles de `server/db/schema.sql`.

```mermaid
erDiagram

    courses {
        TEXT code PK
        TEXT title
        TEXT text_hash "UNIQUE — empreinte SHA-256 normalisée"
        INTEGER text_length
        TEXT text "NULL par défaut ; conservé uniquement si storeText=true"
        TEXT language
        REAL score "NULL si aucune tentative"
        INTEGER last_attempt_at "ms epoch — NULL si aucune tentative"
        INTEGER created_at "ms epoch"
        TEXT owner_key_hash "SHA-256 de la clé propriétaire"
    }

    quizzes {
        TEXT code PK
        TEXT title
        TEXT language
        TEXT difficulty
        INTEGER question_count
        INTEGER source_length "longueur du cours (jamais le texte)"
        INTEGER created_at "ms epoch"
        TEXT owner_key_hash "SHA-256 de la clé propriétaire"
        TEXT course_code FK "NULL si quiz sans cours (ON DELETE CASCADE)"
    }

    questions {
        INTEGER id PK
        TEXT quiz_code FK "ON DELETE CASCADE"
        INTEGER position
        TEXT question
        TEXT choices "JSON : ['a','b','c','d']"
        INTEGER correct_index "0..3"
        TEXT explanation
        TEXT source_excerpt "NULL si origin='manual'"
        INTEGER source_page "NULL si origin='manual'"
        TEXT origin "CHECK IN ('ai','manual')"
    }

    flashcards {
        INTEGER id PK
        TEXT quiz_code FK "ON DELETE CASCADE"
        TEXT front
        TEXT back
        INTEGER source_page "NULL autorisé"
    }

    attempts {
        INTEGER id PK
        TEXT quiz_code FK "ON DELETE CASCADE"
        INTEGER score "bonnes réponses"
        INTEGER total "nombre total de questions"
        INTEGER created_at "ms epoch"
    }

    courses |o--o{ quizzes : "regroupe\n(course_code)"
    quizzes ||--o{ questions : "contient\n(quiz_code)"
    quizzes ||--o{ flashcards : "contient\n(quiz_code)"
    quizzes ||--o{ attempts : "reçoit\n(quiz_code)"
```

## Cardinalités exactes (schéma)

| Relation | Cardinalité | Règle |
|----------|-------------|-------|
| `courses` → `quizzes` | 0..1 à 0..N | `course_code` nullable des deux côtés : un quiz peut exister sans cours, un cours peut n'avoir aucun quiz |
| `quizzes` → `questions` | 1 à 1..N | Contrainte métier (MIN_QUESTIONS = 3, quizzes.controller.js), pas une contrainte SQL — le schéma seul autoriserait 0 |
| `quizzes` → `flashcards` | 1 à 0..N | Peut être vide |
| `quizzes` → `attempts` | 1 à 0..N | Aucune tentative si jamais joué |
| Suppression `courses` | CASCADE | Tous les quiz liés + leurs questions/flashcards/tentatives |
| Suppression `quizzes` | CASCADE | Questions, flashcards, tentatives liées |

## Principes de confidentialité (commentés dans schema.sql)

- `courses.text` : `NULL` par défaut. Le texte du cours n'est stocké **que** si
  l'utilisateur coche « conserver le texte » (`storeText=true`). Les quiz et
  questions ne contiennent **jamais** le texte du cours, seulement sa longueur
  (`source_length`) et l'extrait cité (`source_excerpt`).
- `courses.text_hash` : empreinte SHA-256 du texte **normalisé** (minuscules +
  espaces réduits), sert à reconnaître un même document re-déposé sans stocker
  le texte lui-même.
- `owner_key_hash` : SHA-256 de la clé propriétaire. La clé brute n'est jamais
  persistée ; elle est renvoyée une seule fois au client à la création.
