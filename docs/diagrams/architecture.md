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
            MW_OK["ownerKey.js\n(X-Owner-Key SHA-256 → 403)"]
        end

        subgraph Routes["Routes"]
            R1["POST /generate-quiz"]
            R2["GET/POST/PUT/DELETE\n/quizzes/:code\n/courses/:code\n…"]
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
        R2 --> MW_AC & MW_OK
        MW_AC --> QzCtrl & CCtrl
        MW_OK --> QzCtrl & CCtrl

        QCtrl --> QS & LLM & VS
        QzCtrl --> REPO & VS & QS & SS & SC
        CCtrl --> REPO & SS & SC
        MW_OK --> SS
    end

    subgraph Persistence["💾 SQLite (server/db/)"]
        DB[("quiz-generator.db\ncourses · quizzes\nquestions · flashcards\nattempts")]
    end

    subgraph External["🌐 API externe"]
        Gemini["Google Gemini\n(generativelanguage.googleapis.com)\nmodèle Flash — JSON structuré"]
    end

    %% Liens navigateur ↔ backend
    AC -- "POST /generate-quiz\n[X-Access-Code]\n{text, language, difficulty, questionCount}" --> R1
    QAC -- "REST CRUD\n[X-Access-Code]\n[X-Owner-Key]" --> R2
    R1 & R2 -- "JSON" --> AC & QAC

    %% Backend ↔ SQLite
    REPO -- "DatabaseSync\n(requêtes préparées)" --> DB

    %% Backend ↔ Gemini
    LLM -- "POST generateContent\n{prompt, responseSchema}\ntemperature 0.3 / 0.15\ntimeout 120 s" --> Gemini
    Gemini -- "candidates[0].content.parts[0].text\n(JSON structuré)" --> LLM

    %% Note confidentialité texte
    note1["⚠️ Le texte du cours transite\nvers Gemini uniquement.\nIl N'EST PAS stocké en base\nsauf si storeText=true\n(courses.text, NULL par défaut)"]
    style note1 fill:#fff8dc,stroke:#c8a000,color:#333
    LLM -.->|texte source| note1
    DB -.->|courses.text (nullable)| note1
```

## Légende des flux principaux

| Flèche | Signification |
|--------|---------------|
| `ApiClient → POST /generate-quiz` | Envoi du texte, des paramètres et du code d'accès. Le texte n'est **pas** persisté côté backend avant de partir vers Gemini. |
| `LLMService → Gemini` | Le texte du cours est transmis à Gemini pour générer les questions. C'est le **seul** chemin où le texte sort du navigateur et du backend. |
| `quiz.repository → SQLite` | Seuls le quiz, les questions (avec `source_excerpt`) et les métadonnées sont persistés. **Jamais le texte complet du cours**, sauf `courses.text` si `storeText=true`. |
| `QuizApiClient → REST CRUD` | Enregistrement, lecture, modification et suppression des quiz, questions, cours et tentatives. |
| `CourseStore → localStorage` | Persistance locale (dans le navigateur) des codes et clés des cours créés depuis ce navigateur. |

## Principe de confidentialité du texte (du code vers le schéma)

```
DocumentModel (RAM) ──► ApiClient ──► /generate-quiz ──► llm.service ──► Gemini
                                                       │
                                                       └──► validation.service (ancrage)
                                                                    │
                                                                    ▼
                                          quiz.repository → questions.source_excerpt (extrait, pas le texte entier)

courses.text (SQLite) ← courses.controller ← POST /courses
  ╰── NULL par défaut
  ╰── non-NULL uniquement si body.storeText === true
```
