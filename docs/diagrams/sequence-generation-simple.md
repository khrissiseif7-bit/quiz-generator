# Séquence — Génération d'un quiz (version simplifiée)

Version condensée pour le rapport (complète en annexe :
`sequence-generation.md`). La branche de retry (température 0.15 si moins de
60 % de questions valides) est conservée ; middlewares, quotas et événements
internes sont retirés.

```mermaid
sequenceDiagram
    autonumber
    actor Utilisateur
    participant Front
    participant Backend
    participant LLM as "LLM Service"
    participant Gemini
    participant Validation

    Utilisateur ->> Front: clic Generer
    Front ->> Backend: POST /generate-quiz
    Backend ->> LLM: buildPrompt + callLLM temperature 0.3
    LLM ->> Gemini: generateContent
    Gemini -->> LLM: quiz brut JSON
    LLM -->> Backend: quiz brut
    Backend ->> Validation: validateQuiz schema + ancrage
    Validation -->> Backend: valid / rejected

    alt moins de 60% de questions valides
        Backend ->> LLM: callLLM temperature 0.15 retry
        LLM ->> Gemini: generateContent
        Gemini -->> LLM: quiz brut 2
        LLM -->> Backend: quiz brut 2
        Backend ->> Validation: validateQuiz
        Validation -->> Backend: valid2 / rejected2
    end

    alt au moins 60% valides
        Backend -->> Front: 200 quiz questions + flashcards
        Front -->> Utilisateur: ecran edition
    else toujours moins de 60%
        Backend -->> Front: 502 GENERATION_FAILED
        Front -->> Utilisateur: message erreur
    end
```
