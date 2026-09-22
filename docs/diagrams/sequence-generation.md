# Diagramme de séquence — Génération d'un quiz

Flux : saisie du texte → `UploadController` → `ApiClient` → route `POST /generate-quiz`
→ middlewares → `quiz.controller.generate` → services → réponse → `QuizModel` → `QuizView`.

La branche de **retry** (température 0.15 si < 60 % de survivants) est visible.

```mermaid
sequenceDiagram
    autonumber
    actor Utilisateur
    participant UploadView
    participant UploadController
    participant ApiClient
    participant accessCode as "accessCode.js"
    participant limits as "limits.js"
    participant QuizController as "quiz.controller"
    participant QuotaService as "quota.service"
    participant LLMService as "llm.service"
    participant ValidationService as "validation.service"
    participant QuizModel
    participant QuizView

    Utilisateur ->> UploadView: clic « Générer »
    UploadView ->> UploadController: bus.publish("ui:generate")

    alt Code d'accès absent
        UploadController ->> UploadView: bus.publish("ui:access-code-required")
        Note over UploadController: Aucun appel réseau — arrêt immédiat
    else Code d'accès présent
        UploadController ->> UploadView: bus.publish("screen:show", {name:"loading"})
        UploadController ->> UploadController: détection langue UI (LanguageDetector)
        UploadController ->> ApiClient: generateQuiz(payload, accessCode)

        ApiClient ->> accessCode: POST /generate-quiz\n[X-Access-Code]
        alt Code invalide
            accessCode -->> ApiClient: 401 {error:"INVALID_CODE"}
            ApiClient -->> UploadController: err.httpStatus=401
            UploadController ->> UploadView: bus.publish("app:error", {message:err_401})
        else Code valide
            accessCode ->> limits: next()
            alt Texte < 300 car. ou > MAX_TEXT_LENGTH
                limits -->> ApiClient: 400/413
                ApiClient -->> UploadController: err.httpStatus=400/413
            else Paramètres valides
                limits ->> QuizController: next() → generate(req, res)

                QuizController ->> QuotaService: checkQuota(req.ip)
                alt Quota IP dépassé (5/h ou 20/j) ou quota global (500/j)
                    QuotaService -->> QuizController: {allowed:false, statusCode:429/503}
                    QuizController -->> ApiClient: 429 RATE_LIMITED\nou 503 DAILY_QUOTA_REACHED
                    ApiClient -->> UploadController: err.httpStatus=429/503
                else Quota OK
                    QuotaService -->> QuizController: {allowed:true}

                    QuizController ->> LLMService: detectLanguage(text) [si language=="auto"]
                    LLMService -->> QuizController: langue détectée ("fr"|"ar"|"en")

                    Note over QuizController: Essai 1 — température 0.3
                    QuizController ->> LLMService: buildPrompt({text, language, difficulty, questionCount})
                    LLMService -->> QuizController: prompt (gabarit fr/ar/en)

                    QuizController ->> LLMService: callLLM(prompt, {temperature:0.3})
                    Note over LLMService: Tentative modèle configuré\npuis modèles de repli si 404/503
                    LLMService ->> LLMService: tenterModele(model, corps)\ntimeout 120 s
                    alt Aucun modèle disponible
                        LLMService -->> QuizController: throw err.code="LLM_UNAVAILABLE"
                        QuizController -->> ApiClient: 502 LLM_UNAVAILABLE
                    else Quiz brut reçu
                        LLMService -->> QuizController: quiz brut (JSON)
                        QuizController ->> ValidationService: validateQuiz(quiz, text)
                        Note over ValidationService: schéma AJV + ancrage\n(exact ou fenêtre glissante 85%)
                        ValidationService -->> QuizController: {valid[], rejected[], flashcards[]}

                        alt valid.length / questionCount >= 0.6 (SEUIL_SURVIE)
                            Note over QuizController: Succès dès le premier essai
                        else Moins de 60 % de survivants → retry
                            Note over QuizController: Essai 2 — température 0.15
                            QuizController ->> LLMService: callLLM(prompt, {temperature:0.15})
                            LLMService -->> QuizController: quiz brut (essai 2)
                            QuizController ->> ValidationService: validateQuiz(quiz2, text)
                            ValidationService -->> QuizController: {valid2[], rejected2[], flashcards2[]}

                            alt valid2.length > valid.length
                                Note over QuizController: Garde l'essai 2 (meilleur)
                            else
                                Note over QuizController: Garde l'essai 1 (mieux ou égal)
                            end

                            alt Meilleur essai toujours < 60 % de survivants
                                QuizController -->> ApiClient: 502 GENERATION_FAILED\n{meta:{requested, valid, rejectedReasons}}
                                ApiClient -->> UploadController: err.httpStatus=502, backendCode="GENERATION_FAILED"
                                UploadController ->> UploadView: bus.publish("app:error", err_generation_failed)
                            end
                        end

                        QuizController -->> ApiClient: 200 {language, title, questions[], flashcards[], meta}
                    end
                end
            end
        end

        ApiClient -->> UploadController: donnees (quiz JSON)
        UploadController ->> UploadController: validator.validate(donnees)
        UploadController ->> UploadController: i18n.setLanguage(donnees.language)
        UploadController ->> UploadView: bus.publish("screen:show", {name:"edit"})
        UploadController ->> QuizModel: load(donnees)
        QuizModel ->> QuizModel: _emitEdit()
        QuizModel -->> UploadController: bus.publish("edit:changed", {...})
        UploadController -->> EditView: (via bus) edit:changed → rendu
    end
```

## Points clés du code réel

| Élément | Fichier | Détail |
|---------|---------|--------|
| Seuil retry | `quiz.controller.js:25` | `SEUIL_SURVIE = 0.6` |
| Température essai 1 | `quiz.controller.js:107` | `0.3` |
| Température essai 2 | `quiz.controller.js:115` | `0.15` |
| Choix du meilleur essai | `quiz.controller.js:117-119` | On garde l'essai 2 **seulement** s'il a plus de survivants |
| Timeout LLM | `llm.service.js:223` | 120 s (`AbortController`) |
| Modèle par défaut | `llm.service.js:42` | `gemini-3.5-flash` |
| Modèles de repli | `llm.service.js:47-52` | Basculé si 404 ou 503 Gemini |
| Ancrage | `validation.service.js:113-139` | Exact d'abord, puis fenêtre glissante 85 % |
| Motifs de rejet | `validation.service.js` | `SCHEMA_INVALID`, `EXPLANATION_TOO_SHORT`, `DUPLICATE_CHOICES`, `FORBIDDEN_CHOICE`, `EXCERPT_NOT_FOUND` |
