# Flux de validation d'une question (version simplifiée)

Enchaînement des contrôles appliqués à chaque question générée, dans l'ordre
exact de `server/services/validation.service.js` (`validateQuiz` →
`verifierSemantique` → `extraitAncre`). Une question n'est jamais corrigée :
au premier contrôle qui échoue, elle est écartée avec son motif de rejet. Seules
les questions qui passent toute la chaîne sont conservées.

```mermaid
flowchart TD
    Start([Question générée]) --> S{Schéma ajv valide ?}
    S -->|non| R1[/Rejet : SCHEMA_INVALID/]
    S -->|oui| E{explanation ≥ 40 caractères ?}
    E -->|non| R2[/Rejet : EXPLANATION_TOO_SHORT/]
    E -->|oui| D{4 propositions distinctes ?}
    D -->|non| R3[/Rejet : DUPLICATE_CHOICES/]
    D -->|oui| F{Aucune formulation interdite ?<br/>« toutes / aucune des réponses »}
    F -->|non| R4[/Rejet : FORBIDDEN_CHOICE/]
    F -->|oui| P{explanation sans lettre / numéro / position ?}
    P -->|non| R5[/Rejet : EXPLANATION_POSITIONAL/]
    P -->|oui| A1{source_excerpt inclus tel quel<br/>dans le texte source ?}
    A1 -->|oui| OK([Question acceptée])
    A1 -->|non| A2{Fenêtre glissante ≥ 85 % des mots ?}
    A2 -->|oui| OK
    A2 -->|non| R6[/Rejet : EXCERPT_NOT_FOUND/]
```

L'ancrage se fait en deux temps (`extraitAncre`) : d'abord une inclusion exacte
après normalisation (minuscules, accents et ponctuation retirés, césures
recollées), sinon une correspondance approximative par fenêtre glissante exigeant
au moins 85 % des mots de l'extrait (`SEUIL_ANCRAGE_FLOU`). Les flashcards, elles,
ne sont vérifiées que sur leur schéma (pas d'ancrage) et sont simplement filtrées.
