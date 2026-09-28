# Diagramme de classes — Front (version simplifiée)

Version condensée pour le rapport. Le diagramme complet reste en annexe
(`class-diagram-front.md`). Scindé en deux vues.

## a) Cœur MVC

Principe : les Controllers pilotent les Models ; les Models publient leurs
états via l'EventBus, qui notifie les Views.

```mermaid
classDiagram
    direction TB

    class UploadController
    class EditController
    class QuizController
    class CoursesController

    class DocumentModel {
        +setText()
        +getText()
    }
    class QuizModel {
        +load()
        +answer()
        +computeScore()
    }
    class SettingsModel {
        +setAccessCode()
        +toRequest()
    }
    class EventBus {
        +subscribe()
        +publish()
    }
    class Views

    UploadController --> DocumentModel
    UploadController --> SettingsModel
    UploadController --> QuizModel
    EditController --> QuizModel
    QuizController --> QuizModel
    CoursesController --> DocumentModel
    CoursesController --> SettingsModel

    DocumentModel --> EventBus : publie
    QuizModel --> EventBus : publie
    SettingsModel --> EventBus : publie
    EventBus --> Views : notifie
```

## b) Services

Chaque service est relié au Controller qui l'appelle.

```mermaid
classDiagram
    direction TB

    class UploadController
    class EditController
    class QuizController
    class CoursesController

    class ApiClient {
        +generateQuiz()
        +cancel()
    }
    class QuizApiClient {
        +saveQuiz()
        +getQuiz()
    }
    class CourseStore {
        +all()
        +add()
    }
    class Validator {
        +validate()
    }
    class LanguageDetector {
        +detect()
    }
    class PdfExtractor {
        +extract()
    }
    class I18n {
        +t()
        +setLanguage()
    }

    UploadController --> ApiClient
    UploadController --> QuizApiClient
    UploadController --> Validator
    UploadController --> LanguageDetector
    UploadController --> PdfExtractor
    UploadController --> I18n
    EditController --> QuizApiClient
    EditController --> CourseStore
    EditController --> I18n
    QuizController --> QuizApiClient
    CoursesController --> QuizApiClient
    CoursesController --> CourseStore
    CoursesController --> I18n
```
