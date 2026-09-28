# Modèle de données (version simplifiée)

Diagramme entité-association généré depuis `server/db/schema.sql` (base SQLite).
Principe : on stocke le quiz, jamais le texte du cours — `courses.text` n'est
renseigné que si l'utilisateur choisit de conserver le texte. Clés primaires en
`PK`, clés étrangères en `FK` (toutes en `ON DELETE CASCADE` vers le parent).

```mermaid
erDiagram
    courses ||--o{ quizzes : "possède"
    quizzes ||--o{ questions : "contient"
    quizzes ||--o{ flashcards : "contient"
    quizzes ||--o{ attempts : "enregistre"

    courses {
        TEXT code PK
        TEXT title
        TEXT text_hash "UNIQUE"
        INTEGER text_length
        TEXT text "NULL sauf conservation"
        TEXT language
        REAL score "NULL par défaut"
        INTEGER last_attempt_at
        INTEGER created_at
        TEXT owner_key_hash
    }

    quizzes {
        TEXT code PK
        TEXT title
        TEXT language
        TEXT difficulty
        INTEGER question_count
        INTEGER source_length
        INTEGER created_at
        TEXT owner_key_hash
        TEXT course_code FK "NULL, ON DELETE CASCADE"
    }

    questions {
        INTEGER id PK "AUTOINCREMENT"
        TEXT quiz_code FK
        INTEGER position
        TEXT question
        TEXT choices "JSON de 4 chaînes"
        INTEGER correct_index
        TEXT explanation
        TEXT source_excerpt "NULL si manuelle"
        INTEGER source_page
        TEXT origin "ai | manual"
    }

    flashcards {
        INTEGER id PK "AUTOINCREMENT"
        TEXT quiz_code FK
        TEXT front
        TEXT back
        INTEGER source_page
    }

    attempts {
        INTEGER id PK "AUTOINCREMENT"
        TEXT quiz_code FK
        INTEGER score
        INTEGER total
        INTEGER created_at
    }
```
