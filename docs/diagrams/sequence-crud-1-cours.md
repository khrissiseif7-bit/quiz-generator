# Séquence CRUD (1/3) — Création / déduplication du cours

Portion 1 de `sequence-crud.md` (découpée pour tenir en annexe A4) :
`POST /courses` avec calcul d'empreinte et déduplication (cours déjà connu vs
nouveau cours). Le diagramme complet reste dans `sequence-crud.md`.

```mermaid
sequenceDiagram
    autonumber
    actor Utilisateur
    participant EditView
    participant EditController
    participant QuizApiClient
    participant CourseStore
    participant accessCode as "accessCode.js"
    participant CoursesCtrl as "courses.controller"
    participant SecurityService as "security.service"
    participant QuizRepository as "quiz.repository"
    participant DB as "SQLite (DatabaseSync)"

    Utilisateur ->> EditView: clic « Enregistrer »
    EditView ->> EditController: bus.publish("ui:save-quiz")
    EditController ->> EditController: quizModel.saved === false → continue

    Note over EditController: settingsModel.attachToCourses === true\net quizModel.sourceText non vide

    EditController ->> QuizApiClient: createCourse({title, text, language, storeText}, accessCode)
    QuizApiClient ->> accessCode: POST /courses [X-Access-Code]
    accessCode ->> CoursesCtrl: next() → creerCours(req, res)

    CoursesCtrl ->> SecurityService: empreinteTexte(body.text)
    SecurityService -->> CoursesCtrl: textHash (SHA-256 du texte normalisé)

    CoursesCtrl ->> QuizRepository: lireCoursParHash(textHash)
    QuizRepository ->> DB: SELECT * FROM courses WHERE text_hash = ?
    DB -->> QuizRepository: null ou cours existant

    alt Cours déjà connu (même empreinte)
        QuizRepository -->> CoursesCtrl: cours existant
        CoursesCtrl -->> QuizApiClient: 200 {code, title, language, existing:true}
        QuizApiClient -->> EditController: {code, existing:true} (pas d'ownerKey)
        EditController ->> CourseStore: get(cours.code)
        CourseStore -->> EditController: {code, ownerKey, title, language} (depuis localStorage)
        Note over EditController: courseOwnerKey = connu.ownerKey\nquizModel.courseCode = cours.code
    else Nouveau cours
        CoursesCtrl ->> SecurityService: genererCleProprietaire()
        SecurityService -->> CoursesCtrl: ownerKey (32 hex)
        CoursesCtrl ->> SecurityService: hacher(ownerKey)
        SecurityService -->> CoursesCtrl: ownerKeyHash (SHA-256)
        CoursesCtrl ->> QuizRepository: creerCours({code, title, textHash, textLength,\ntext (si storeText=true sinon null),\nlanguage, createdAt, ownerKeyHash})
        QuizRepository ->> DB: INSERT INTO courses …
        DB -->> QuizRepository: ok
        CoursesCtrl -->> QuizApiClient: 201 {code, ownerKey}
        QuizApiClient -->> EditController: {code, ownerKey}
        EditController ->> CourseStore: add({code, ownerKey, title, language})
        Note over CourseStore: Persisté dans localStorage
        Note over EditController: courseOwnerKey = ownerKey\nquizModel.courseCode = cours.code
    end
```
