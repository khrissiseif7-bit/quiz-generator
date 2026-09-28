# Séquence CRUD (2/3) — Enregistrement du quiz rattaché

Portion 2 de `sequence-crud.md` (découpée pour tenir en annexe A4) :
`POST /quizzes` (quota, vérification de la clé du cours, transaction d'insertion)
puis re-synchronisation via `GET /quizzes/:code`. Le diagramme complet reste
dans `sequence-crud.md`.

```mermaid
sequenceDiagram
    autonumber
    actor Utilisateur
    participant EditView
    participant EditController
    participant QuizApiClient
    participant QuizModel
    participant accessCode as "accessCode.js"
    participant QuizzesCtrl as "quizzes.controller"
    participant SecurityService as "security.service"
    participant QuizRepository as "quiz.repository"
    participant DB as "SQLite (DatabaseSync)"

    EditController ->> QuizModel: toSavePayload()
    QuizModel -->> EditController: {title, language, difficulty, source_length,\ncourse_code, questions[], flashcards[]}
    Note over EditController: Le texte du cours n'est JAMAIS dans ce payload

    EditController ->> QuizApiClient: saveQuiz(payload, accessCode, courseOwnerKey)
    QuizApiClient ->> accessCode: POST /quizzes [X-Access-Code]\n[X-Owner-Key: courseOwnerKey]
    accessCode ->> QuizzesCtrl: next() → creerQuiz(req, res)

    QuizzesCtrl ->> QuizzesCtrl: checkCreateQuizQuota(req.ip)
    alt Quota 10/h dépassé
        QuizzesCtrl -->> QuizApiClient: 429 RATE_LIMITED
        QuizApiClient -->> EditController: err.httpStatus=429
        EditController ->> EditView: bus.publish("edit:save-error", {message})
    else Quota OK
        QuizzesCtrl ->> QuizRepository: lireCours(body.course_code)
        QuizRepository -->> QuizzesCtrl: cours (pour vérifier que la clé du cours est correcte)
        QuizzesCtrl ->> SecurityService: hacher(req.headers["x-owner-key"])
        alt Hash ≠ cours.owner_key_hash
            QuizzesCtrl -->> QuizApiClient: 403 FORBIDDEN
        else Hash correct
            QuizzesCtrl ->> SecurityService: genererCleProprietaire()
            SecurityService -->> QuizzesCtrl: ownerKey quiz
            QuizzesCtrl ->> QuizRepository: creerQuiz({code, title, …, courseCode, questions[], flashcards[]})
            Note over QuizRepository: Transaction BEGIN/COMMIT :\nINSERT quizzes + N×INSERT questions\n+ M×INSERT flashcards
            QuizRepository ->> DB: INSERT INTO quizzes …
            QuizRepository ->> DB: INSERT INTO questions × N
            QuizRepository ->> DB: INSERT INTO flashcards × M
            DB -->> QuizRepository: ok
            QuizzesCtrl -->> QuizApiClient: 201 {code, ownerKey}
        end
    end

    QuizApiClient -->> EditController: {code, ownerKey}
    EditController ->> QuizModel: markSaved(code, ownerKey)
    QuizModel ->> QuizModel: _emitEdit()

    Note over EditController: _resync() : recharge depuis le serveur\npour récupérer les ids réels des questions
    EditController ->> QuizApiClient: getQuiz(code, accessCode)
    QuizApiClient ->> QuizzesCtrl: GET /quizzes/:code (pas de code d'accès requis)
    QuizzesCtrl ->> QuizRepository: lireQuizComplet(code)
    QuizRepository ->> DB: SELECT quizzes + questions + flashcards
    DB -->> QuizRepository: données complètes
    QuizRepository -->> QuizzesCtrl: quiz complet (avec owner_key_hash)
    QuizzesCtrl ->> QuizzesCtrl: sansHash(quiz) — retire owner_key_hash
    QuizzesCtrl -->> QuizApiClient: 200 quiz complet
    QuizApiClient -->> EditController: quiz avec ids serveur réels
    EditController ->> QuizModel: syncFromServer(serverQuiz)
    EditController ->> EditView: bus.publish("edit:saved", {code, ownerKey})
    EditView -->> Utilisateur: affiche code + clé
```
