# Schéma d'architecture générale

```mermaid
flowchart TB
    subgraph Navigateur["🖥️ Navigateur (SPA — ES modules, public/js/)"]
        direction TB

        subgraph Services_Front["Services"]
            EB["EventBus\n(médiateur pub/sub)"]
            AC["ApiClient\n(POST /generate-quiz)"]
            QAC["QuizApiClient\n(CRUD REST)"]
            CS["CourseStore\n(localStorage)"]
            PE["PdfExtractor\n(pdf.js)"]
            LD["LanguageDetector"]
            Val["Validator"]
            I18n["I18n"]
        end

        subgraph Models["Models"]
            DM["DocumentModel\ntexte source (RAM)"]
            QM["QuizModel\nquiz + flashcards"]
            SM["SettingsModel\nlangue/difficulté/count"]
        end

        subgraph Controllers["Controllers"]
            UC["UploadController"]
            EC["EditController"]
            QC["QuizController"]
            CC["CoursesController"]
        end

        subgraph Views["Views"]
            UV["UploadView"]
            LV["LoadingView"]
            EV["EditView"]
            QV["QuizView"]
            RV["ResultView"]
            FV["FlashcardView"]
            CV["CoursesView"]
        end

        %% Flux interne
        Controllers -- "publie intentions\n(ui:*)" --> EB
        Models -- "publie états\n(document:changed\nedit:changed\nquiz:question…)" --> EB
        EB -- "notifie" --> Views
        Controllers --> Models
        Controllers --> Services_Front
    end

    subgraph Backend["⚙️ Backend Express (server/)"]
        direction TB

        subgraph Middlewares["Middlewares"]
            MW_AC["accessCode.js\n(X-Access-Code → 401)"]
            MW_LIM["limits.js\n(taille/params → 400/413)"]
            MW_OK["ownerKey.js\n(X-Owner-Key SHA-256 → 403 ou 404)"]
        end

        subgraph Routes["Routes"]
            R1["POST /generate-quiz"]
            R2R["LECTURE (publique)\nGET /quizzes/:code\nGET /courses/:code\nGET /quizzes/:code/stats"]
            R2W["ÉCRITURE\nPOST /quizzes · POST /courses\nPUT/DELETE quiz|cours\nCRUD questions · POST /attempts"]
        end

        subgraph Controllers_Back["Controllers"]
            QCtrl["quiz.controller\ngenerate()"]
            QzCtrl["quizzes.controller\ncreerQuiz/lireQuiz…"]
            CCtrl["courses.controller\ncreerCours/lireCours…"]
        end

        subgraph Services_Back["Services"]
            LLM["llm.service\ndetectLanguage()\nbuildPrompt()\ncallLLM()"]
            VS["validation.service\nvalidateQuiz()\nvaliderCorpsQuestion()"]
            QS["quota.service\ncheckQuota()\ncheckCreateQuizQuota()"]
            SS["security.service\ngenererCode()\nhacher()\nempreinteTexte()"]
            SC["score.service\ncalculerNouveauScore()\nscoreAffiche()"]
            REPO["quiz.repository\n(requêtes SQL préparées)"]
        end

        R1 --> MW_AC --> MW_LIM --> QCtrl

        %% Lecture : accessible sans code d'accès ni clé propriétaire.
        %% Le texte complet (courses.text) n'est renvoyé que si la bonne
        %% X-Owner-Key est fournie — cette vérification a lieu DANS le
        %% controller, pas via le middleware ownerKey.js.
        R2R --> QzCtrl & CCtrl

        %% Écriture : code d'accès requis pour toutes les routes.
        R2W --> MW_AC

        %% PUT/DELETE d'un quiz ou d'un cours, et CRUD des questions,
        %% exigent en plus la bonne X-Owner-Key.
        MW_AC -- "création\n(POST)" --> QzCtrl & CCtrl
        MW_AC -- "modification/suppression\n(PUT, DELETE, questions)" --> MW_OK
        MW_OK --> QzCtrl & CCtrl

        QCtrl --> QS & LLM & VS
        QzCtrl --> REPO & VS & QS & SS & SC
        CCtrl --> REPO & SS & SC
        MW_OK --> SS
    end

    subgraph Persistence["💾 SQLite (server/data/)"]
        DB[("quiz.db\ncourses · quizzes\nquestions · flashcards\nattempts")]
    end

    subgraph External["🌐 API externe"]
        Gemini["Google Gemini\n(generativelanguage.googleapis.com)\nmodèle Flash — JSON structuré"]
    end

    %% Liens navigateur ↔ backend
    AC -- "POST /generate-quiz\n[X-Access-Code]\n{text, language, difficulty, questionCount}" --> R1
    QAC -- "REST CRUD\n[X-Access-Code sur écriture]\n[X-Owner-Key sur modif/suppr]" --> R2R & R2W
    R1 & R2R & R2W -- "JSON" --> AC & QAC

    %% Backend ↔ SQLite
    REPO -- "DatabaseSync\n(requêtes préparées)" --> DB

    %% Backend ↔ Gemini
    LLM -- "POST generateContent\n{prompt, responseSchema}\ntemperature 0.3 / 0.15\ntimeout 120 s" --> Gemini
    Gemini -- "candidates[0].content.parts[0].text\n(JSON structuré)" --> LLM

    %% Note confidentialité texte
    note1["⚠️ Le texte du cours transite\nvers Gemini uniquement.\nIl N'EST PAS stocké en base\nsauf si storeText=true\n(courses.text, NULL par défaut)"]
    style note1 fill:#fff8dc,stroke:#c8a000,color:#333
    LLM -.->|texte source| note1
    DB -.->|courses.text nullable| note1
```

## Légende des flux principaux

| Flèche | Signification |
|--------|---------------|
| `ApiClient → POST /generate-quiz` | Envoi du texte, des paramètres et du code d'accès. Le texte n'est **pas** persisté côté backend avant de partir vers Gemini. |
| `LLMService → Gemini` | Le texte du cours est transmis à Gemini pour générer les questions. C'est le **seul** chemin où le texte sort du navigateur et du backend. |
| `quiz.repository → SQLite` | Seuls le quiz, les questions (avec `source_excerpt`) et les métadonnées sont persistés. **Jamais le texte complet du cours**, sauf `courses.text` si `storeText=true`. |
| `QuizApiClient → REST CRUD` | Enregistrement, lecture, modification et suppression des quiz, questions, cours et tentatives. |
| `CourseStore → localStorage` | Persistance locale (dans le navigateur) des codes et clés des cours créés depuis ce navigateur. |
| `R2R` (lecture) | Consultation d'un quiz, d'un cours ou de ses statistiques : accessible sans code d'accès, protégée uniquement par le code à 6 caractères non devinable. Nécessaire pour que l'onglet « Mes cours » fonctionne après un rechargement de page, sans ressaisie du code d'accès. |
| `R2W` (écriture) | Création, modification, suppression : exige toujours le code d'accès. La modification/suppression d'un quiz ou d'un cours, ainsi que le CRUD des questions, exige en plus la bonne `X-Owner-Key`. Le middleware `ownerKey.js` renvoie **403** si la clé est absente ou incorrecte, **404** si la ressource n'existe pas. |

## Principe de confidentialité du texte (du code vers le schéma)

```
DocumentModel (RAM) ──► ApiClient ──► POST /generate-quiz ──► llm.service ──► Gemini
                                            │
                                            └──► validation.service (ancrage)
                                                         │
                                                         ▼
                                   quiz validé (questions + source_excerpt) renvoyé au
                                   navigateur — la génération ne persiste RIEN en base

navigateur ──► QuizApiClient ──► POST /quizzes ──► quizzes.controller ──► quiz.repository
                                                                                │
                                                                                ▼
                                     questions.source_excerpt (extrait cité, jamais le texte entier)

courses.text (SQLite) ← courses.controller ← POST /courses
  ╰── NULL par défaut
  ╰── non-NULL uniquement si body.storeText === true
```

## Note sur l'évolution de ce schéma (post-correctif)

Une version antérieure de ce diagramme faisait passer **toutes** les routes
`/quizzes/:code` et `/courses/:code` (lecture comme écriture) par
`accessCode.js` et `ownerKey.js`. Cela provoquait un bug réel : l'onglet
« Mes cours » recevait une erreur 401 après un rechargement de page, car le
code d'accès n'est conservé qu'en **mémoire** côté client (jamais dans
`localStorage` ni `sessionStorage` — voir `SettingsModel.js`) : il est oublié
au rechargement (F5) et n'était donc plus transmis. Le correctif a consisté à séparer les routes de lecture
(consultation, sans coût de quota LLM) des routes d'écriture, en ne
protégeant les premières que par leur code non devinable.