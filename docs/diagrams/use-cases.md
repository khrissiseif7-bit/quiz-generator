# Diagramme de cas d'utilisation

> Mermaid ne supporte pas nativement le diagramme UML `usecase`. Le bloc
> ci-dessous utilise un **flowchart** qui reproduit fidèlement la notation :
> ellipses pour les cas d'utilisation, rectangles pour les acteurs, flèches
> d'association et stéréotypes `<<include>>` / `<<extend>>`.

```mermaid
flowchart LR
    %% ── Acteurs ────────────────────────────────────────────────
    Eleve["👤 Élève"]
    Enseignant["👤 Enseignant"]
    Systeme["⚙️ Système\n(Express + Gemini)"]

    %% ── Cas d'utilisation : saisie & génération ────────────────
    UC1(["Saisir un texte de cours"])
    UC2(["Importer un PDF"])
    UC3(["Générer un quiz depuis un texte"])
    UC4(["Générer un quiz depuis un PDF"])

    %% ── Cas d'utilisation : édition & persistance ──────────────
    UC5(["Vérifier / modifier les questions"])
    UC6(["Enregistrer un quiz"])
    UC7(["Ouvrir un quiz par code"])

    %% ── Cas d'utilisation : jeu ────────────────────────────────
    UC8(["Jouer un quiz"])
    UC9(["Rejouer les erreurs"])
    UC10(["Consulter les flashcards"])

    %% ── Cas d'utilisation : cours & progression ────────────────
    UC11(["Suivre la progression d'un cours"])
    UC12(["Réviser un cours"])

    %% ── Services systèmes ────────────────────────────────────────
    SYS1(["Détecter la langue"])
    SYS2(["Appeler Gemini (LLM)"])
    SYS3(["Valider + ancrer les questions"])
    SYS4(["Calculer le score de révision"])
    SYS5(["Contrôler le quota / rate-limit"])
    SYS6(["Vérifier le code d'accès"])

    %% ── Associations Élève (usage principal : générer et jouer ses propres quiz) ──
    Eleve --> UC1
    Eleve --> UC2
    Eleve --> UC3
    Eleve --> UC4
    Eleve --> UC7
    Eleve --> UC8
    Eleve --> UC9
    Eleve --> UC10
    Eleve --> UC11
    Eleve --> UC12

    %% ── Enseignant : spécialise l'Élève (hérite de ses cas) + édition & partage ──
    Enseignant -. "«spécialise»" .-> Eleve
    Enseignant --> UC5
    Enseignant --> UC6

    %% ── include : génération depuis texte ───────────────────────
    UC3 -- "«include»" --> SYS6
    UC3 -- "«include»" --> SYS5
    UC3 -- "«include»" --> SYS1
    UC3 -- "«include»" --> SYS2
    UC3 -- "«include»" --> SYS3

    %% ── include : génération depuis PDF ────────────────────────
    UC4 -- "«include»" --> UC2
    UC4 -- "«include»" --> UC3

    %% ── include : enregistrement ────────────────────────────────
    UC6 -- "«include»" --> SYS6

    %% ── extend : après le quiz ──────────────────────────────────
    UC9 -. "«extend»" .-> UC8
    UC10 -. "«extend»" .-> UC8

    %% ── include : tentative → score ────────────────────────────
    UC8 -- "«include»" --> SYS4

    %% ── include : révision ──────────────────────────────────────
    UC12 -- "«include»" --> UC3

    %% ── Associations Système ────────────────────────────────────
    Systeme --> SYS1
    Systeme --> SYS2
    Systeme --> SYS3
    Systeme --> SYS4
    Systeme --> SYS5
    Systeme --> SYS6
```

## Notes sur les acteurs et les cas

| Acteur | Rôle dans le code |
|--------|------------------|
| **Élève** | Usage principal du produit : dépose un texte ou un PDF, **génère un quiz** depuis son cours, le joue, rejoue ses erreurs, consulte les flashcards, ouvre un quiz par code, et **suit / révise sa progression**. Le code d'accès partagé reste requis pour générer (barrière anti-abus) ; les lectures (jouer, consulter) sont libres. |
| **Enseignant** | **Spécialisation de l'Élève** : fait tout ce que fait l'Élève, et s'en distingue par l'**édition** (vérifier / modifier les questions, UC5) et le **partage** (enregistrer un quiz pour le diffuser par code, UC6). Détient la **clé propriétaire** (`X-Owner-Key`) qu'exigent ces écritures sur une ressource. |
| **Système** | Express + Gemini Flash. Détecte la langue (heuristique sans SDK), appelle Gemini via API REST, valide par ancrage (AJV + fenêtre glissante), gère quota/rate-limit en mémoire. |

### Règles d'accès réelles (middlewares)
- `requireAccessCode` (accessCode.js) : toutes les **écritures** (génération, POST/PUT/DELETE). Désactivé si `ACCESS_CODE` absent dans `.env` (mode dev).
- `ownerKeyRequired` (ownerKey.js) : PUT/DELETE d'un quiz ou d'un cours, CRUD des questions — compare SHA-256 de `X-Owner-Key` au hash stocké.
- Les **lectures** (GET /quizzes/:code, GET /courses/:code) sont libres : pas de code d'accès requis.
