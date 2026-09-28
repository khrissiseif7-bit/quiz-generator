# Séquence CRUD (3/3) — Modification d'une question (X-Owner-Key)

Portion 3 de `sequence-crud.md` (découpée pour tenir en annexe A4) :
`PUT /quizzes/:code/questions/:id` avec vérification de la clé propriétaire par
le middleware `ownerKey.js`, puis validation et mise à jour. Le diagramme complet
reste dans `sequence-crud.md`.

```mermaid
sequenceDiagram
    autonumber
    actor Utilisateur
    participant EditView
    participant EditController
    participant QuizApiClient
    participant accessCode as "accessCode.js"
    participant ownerKey as "ownerKey.js"
    participant QuizzesCtrl as "quizzes.controller"
    participant QuizRepository as "quiz.repository"
    participant DB as "SQLite (DatabaseSync)"

    Utilisateur ->> EditView: modifie une question, clic « Valider »
    EditView ->> EditController: bus.publish("ui:edit-save", {localId, id, data})

    Note over EditController: quizModel.saved === true → via API

    EditController ->> QuizApiClient: updateQuestion(code, id, data, accessCode, ownerKey)
    QuizApiClient ->> accessCode: PUT /quizzes/:code/questions/:id\n[X-Access-Code]\n[X-Owner-Key]
    accessCode ->> ownerKey: next()
    ownerKey ->> QuizRepository: ownerHashDuQuiz(req.params.code)
    QuizRepository ->> DB: SELECT owner_key_hash FROM quizzes WHERE code = ?
    DB -->> QuizRepository: hash stocké
    QuizRepository -->> ownerKey: hash
    ownerKey ->> ownerKey: hacher(X-Owner-Key) === hash stocké ?
    alt Hash incorrect
        ownerKey -->> QuizApiClient: 403 FORBIDDEN
        QuizApiClient -->> EditController: err.httpStatus=403
        EditController ->> EditView: bus.publish("edit:save-result", {ok:false})
    else Hash correct
        ownerKey ->> QuizzesCtrl: next() → majQuestion(req, res)
        QuizzesCtrl ->> QuizRepository: lireQuestion(code, id)
        alt Question introuvable
            QuizzesCtrl -->> QuizApiClient: 404 NOT_FOUND
        else Question existe
            QuizzesCtrl ->> QuizzesCtrl: validerCorpsQuestion(req.body)
            alt Validation échoue
                QuizzesCtrl -->> QuizApiClient: 400 VALIDATION_ERROR {details[]}
            else Valide
                QuizzesCtrl ->> QuizRepository: majQuestion(code, id, {question, choices, correct_index, explanation})
                QuizRepository ->> DB: UPDATE questions SET … WHERE quiz_code=? AND id=?
                DB -->> QuizRepository: ok
                QuizRepository -->> QuizzesCtrl: question mise à jour
                QuizzesCtrl -->> QuizApiClient: 200 question
                QuizApiClient -->> EditController: question
                EditController ->> EditController: _resync() [recharge le quiz entier]
                EditController ->> EditView: bus.publish("edit:save-result", {localId, ok:true})
                EditView -->> Utilisateur: question mise à jour dans l'UI
            end
        end
    end
```
