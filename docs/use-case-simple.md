# Diagramme de cas d'utilisation (version simplifiée)

Mermaid n'a pas de diagramme de cas d'utilisation natif : on utilise un
`flowchart LR` avec l'acteur « Utilisateur » à gauche, les cas d'utilisation en
forme ovale dans un sous-graphe « Application », et « Gemini » comme acteur
externe à droite. Les cas correspondent aux routes de `server/routes/`
(`/generate-quiz`, CRUD `/quizzes`, `/courses`, `/attempts`) et aux écrans de
`public/js/views/` (dépôt, réglages, jeu, relecture, révision, cours).

```mermaid
flowchart LR
    User(("Utilisateur"))
    Gemini(("Gemini"))

    subgraph App["Application"]
        UC1(["Déposer un cours (PDF ou texte)"])
        UC2(["Choisir les réglages (langue, difficulté, nombre)"])
        UC3(["Générer un quiz"])
        UC4(["Vérifier par ancrage l'extrait source"])
        UC5(["Relire et modifier le quiz"])
        UC6(["Enregistrer un quiz / retrouver par code"])
        UC7(["Jouer le quiz"])
        UC8(["Réviser avec les cartes"])
        UC9(["Rejouer les erreurs"])
        UC10(["Suivre ses cours et leur score"])
    end

    User --> UC1
    User --> UC2
    User --> UC3
    User --> UC5
    User --> UC6
    User --> UC7
    User --> UC8
    User --> UC9
    User --> UC10

    UC3 -->|"appel de génération"| Gemini
    Gemini -->|"quiz JSON"| UC3
    UC3 -.->|"«include»"| UC4

    UC7 -.->|"«extend»"| UC9
```

L'ancrage (`UC4`) est inclus dans la génération : chaque `source_excerpt` produit
par Gemini doit exister réellement dans le cours, sinon la question est écartée
(`server/services/validation.service.js`). « Rejouer les erreurs » prolonge le
jeu du quiz uniquement lorsqu'il reste des réponses fausses (`ResultView.js`).
