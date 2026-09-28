# Séquence — CRUD représentatif (version simplifiée)

Version condensée pour le rapport (complète en annexe : `sequence-crud.md`).
Un seul scénario : enregistrement d'un quiz rattaché à un cours, puis
modification d'une question avec vérification de la clé propriétaire.

```mermaid
sequenceDiagram
    autonumber
    actor Utilisateur
    participant Front
    participant Backend
    participant Repository
    participant DB as "SQLite"

    Utilisateur ->> Front: clic Enregistrer
    Front ->> Backend: POST /courses avec texte pour empreinte
    Backend ->> Repository: lireCoursParHash puis creerCours
    Repository ->> DB: SELECT puis INSERT courses
    DB -->> Repository: ok
    Backend -->> Front: code cours + ownerKey

    Front ->> Backend: POST /quizzes avec X-Owner-Key du cours
    Backend ->> Backend: verifie hacher X-Owner-Key = hash du cours
    Backend ->> Repository: creerQuiz quiz + questions + flashcards
    Repository ->> DB: INSERT quizzes, questions, flashcards
    DB -->> Repository: ok
    Backend -->> Front: 201 code + ownerKey du quiz

    Utilisateur ->> Front: modifie une question
    Front ->> Backend: PUT question avec X-Owner-Key
    Backend ->> Repository: ownerHashDuQuiz
    Repository ->> DB: SELECT owner_key_hash
    DB -->> Repository: hash stocke
    Backend ->> Backend: hacher X-Owner-Key = hash stocke ?

    alt Hash incorrect
        Backend -->> Front: 403 FORBIDDEN
        Front -->> Utilisateur: acces refuse
    else Hash correct
        Backend ->> Repository: majQuestion
        Repository ->> DB: UPDATE questions
        DB -->> Repository: ok
        Backend -->> Front: 200 question mise a jour
        Front -->> Utilisateur: confirmation
    end
```
