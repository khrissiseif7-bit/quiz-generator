# Diagramme de classes — Backend (version simplifiée)

Version condensée pour le rapport (complet en annexe : `class-diagram-back.md`).
Vue en couches : routes → middlewares → controllers → services → repository.
Les trois middlewares sont regroupés en un seul bloc.

```mermaid
classDiagram
    direction TB

    class QuizRoutes {
        <<router>>
    }
    class QuizzesRoutes {
        <<router>>
    }
    class Middlewares {
        accessCode
        limits
        ownerKey
    }
    class QuizController {
        <<controller>>
    }
    class QuizzesController {
        <<controller>>
    }
    class CoursesController {
        <<controller>>
    }
    class LLMService {
        +callLLM()
    }
    class ValidationService {
        +validateQuiz()
    }
    class QuotaService
    class SecurityService
    class ScoreService
    class QuizRepository {
        <<repository>>
    }

    QuizRoutes --> Middlewares
    QuizRoutes --> QuizController
    QuizzesRoutes --> Middlewares
    QuizzesRoutes --> QuizzesController
    QuizzesRoutes --> CoursesController

    QuizController --> QuotaService
    QuizController --> LLMService
    QuizController --> ValidationService

    QuizzesController --> ValidationService
    QuizzesController --> QuotaService
    QuizzesController --> SecurityService
    QuizzesController --> ScoreService
    QuizzesController --> QuizRepository

    CoursesController --> SecurityService
    CoursesController --> ScoreService
    CoursesController --> QuizRepository

    Middlewares --> SecurityService
```
