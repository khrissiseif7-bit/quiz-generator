# Mesures des tests du générateur de quiz

> Fichier de données brutes. Pas de rédaction : les chiffres seront repris dans le chapitre
> "Tests et évaluation" du rapport. Toute nouvelle mesure doit être ajoutée dans le tableau.

---

## Synthèse

### Taux de questions valides par langue (prompt v1, post-correctif modèle)

| Langue | Runs | Q. demandées | Q. valides | Taux valides | Taux rejet |
|--------|------|-------------|-----------|-------------|-----------|
| fr | 8 (2 indiv. + 6 répétés) | 80 | 77 | **96,3 %** | 3,7 % |
| ar | 2 | 20 | 20 | **100,0 %** | 0,0 % |
| en | 2 | 20 | 20 | **100,0 %** | 0,0 % |

Motif de rejet unique observé : `DUPLICATE_CHOICES` (qualité LLM, pas d'échec d'ancrage).
Objectif < 30 % de rejet atteint sur les trois langues.

---

### Latence par tranche de longueur de texte

Les runs principaux portent sur des textes < 5 000 c. Un point partiel existe
pour la tranche 5 000–15 000 c (texte code PDF numpy, voir note ci-dessous).

**Tranche < 5 000 caractères (n = 3 par contexte, 10 questions, difficulté medium)**

| Contexte | n | Latence moyenne | Écart-type (σ) | Min | Max |
|----------|---|----------------|---------------|-----|-----|
| LLM direct (hors HTTP) | 3 | 23,7 s | 2,6 s | 20,0 s | 26,0 s |
| HTTP end-to-end (`meta.durationMs`) | 3 | 19,5 s | 1,7 s | 17,6 s | 21,7 s |

L'écart LLM direct / HTTP s'explique par le changement de modèle entre les deux séances
(`gemini-2.0-flash` → `gemini-3.5-flash`, plus rapide). Les deux séries ne sont donc pas
comparables à modèle identique.

**Point partiel tranche 5 000–15 000 c :** texte extrait PDF numpy (8 801 c, 5q, medium,
`gemini-3.5-flash-lite`) → 107,5 s, mais 0/5 valides (`SCHEMA_INVALID`) — contenu
code Python dense ; non représentatif d'un texte de cours normal. À confirmer sur un
cours rédigé de même longueur.

---

### Variance sur runs répétés (fr, cours-fr.txt = 4 427 c, 10 questions, prompt v1, gemini-3.5-flash)

| Run | Q. valides / 10 | Q. rejetées | Motif |
|-----|----------------|-------------|-------|
| 1 | 10 | 0 | — |
| 2 | 10 | 0 | — |
| 3 | 10 | 0 | — |
| 4 | 9 | 1 | `DUPLICATE_CHOICES` |
| 5 | 10 | 0 | — |
| 6 | 9 | 1 | `DUPLICATE_CHOICES` |
| **Agrégé** | **9,67 / 10** | **0,33 / run** | σ = **0,47 questions** |

Taux de rejet moyen : **3,3 %**. Aucun run sous le seuil de 60 % de survivantes
→ zéro `GENERATION_FAILED` sur cet échantillon.
Date et durée de ces 6 runs non enregistrées au moment de la mesure (n/d).

---

### Avant / après renforcement du prompt de difficulté

- **Prompt v1** (2026-09-07 / 2026-09-08) : instruction brute `Difficulté demandée : {difficulty}`,
  sans définition des niveaux. Données disponibles : voir tableau ci-dessous (tous runs medium).
  Qualité des questions difficiles vs moyennes : **non évaluée sur ces runs** (difficulté medium uniquement).

- **Prompt v2** (en production depuis 2026-09-22) : définitions concrètes FACILE / MOYEN / DIFFICILE
  + exemple fictif LED/batterie + règle INTERDIT pour le niveau difficile.

**Runs post-v2 réalisés le 2026-09-22 — cours photosynthèse (4 044 c, fr, 10 questions, `gemini-3.5-flash-lite`) :**

| Niveau | Q. val. | Q. rej. | Motif rejet | Durée |
|--------|---------|---------|-------------|-------|
| easy   | 10/10   | 0       | —           | 11,9 s |
| medium | 10/10   | 0       | —           | 56,7 s |
| hard   | 9/10    | 1       | `EXCERPT_NOT_FOUND` | 68,2 s |

**Exemples qualitatifs — niveau DIFFICILE (9 questions valides retenues) :**

| # | Stratégie v2 | Question générée (résumée) | Critère vérifié |
|---|-------------|---------------------------|-----------------|
| Q3 | (b) calcul chiffré | "Combien de voitures (2 t CO₂/an) compense une forêt de 10 000 arbres ?" → **110 voitures** (220 t ÷ 2 t) | ✓ exploite les deux valeurs chiffrées §6 |
| Q4 | (c) règle → cas nouveau | "Plante avec lumière max + température optimale mais CO₂ très pauvre : que se passe-t-il ?" | ✓ applique la règle du facteur limitant (§4) à un cas non cité mot pour mot |
| Q5 | (a) croisement §2 × §3 | "Par quel mécanisme le réactif gazeux du cycle de Calvin pénètre-t-il dans la plante ?" | ✓ croise stomates §2 + CO₂ réactif du cycle de Calvin §3 |
| Q1 | (a) croisement intra-§3 | "Quelles structures du chloroplaste produisent ATP et transforment CO₂ en glucose ?" | ✓ croise membrane thylakoïde et stroma dans §3 |
| Q8 | — | "Comment la chlorophylle donne-t-elle la couleur verte aux feuilles ?" | ✗ question de rappel (FACILE) glissée dans le lot DIFFICILE — régression marginale |

**Observations :**
- Le prompt v2 génère correctement des questions qui croisent deux sections et des calculs numériques sur les données chiffrées.
- 1 question sur 9 reste de type FACILE (rappel direct §1) malgré le niveau DIFFICILE demandé : la définition n'est pas parfaitement contraignante pour tous les tirages.
- 1 rejet `EXCERPT_NOT_FOUND` : le LLM a cité un extrait introuvable verbatim dans le cours pour une question difficile (tentative de combinaison de deux passages en un seul extrait).

---

## Données brutes

**Conventions :**
- `v1` = prompt initial (instruction difficulté brute) ; `v2` = prompt avec définitions par niveau (depuis 2026-09-22).
- Durées en **secondes, une décimale**. Les valeurs directement issues des logs ms sont indiquées
  entre parenthèses. Valeurs approximatives (mesurées manuellement) marquées `~`.
- `n/d` = non disponible (non enregistré au moment du run).
- Contexte « LLM direct » = banc d'essai hors HTTP ; « HTTP » = `meta.durationMs` du serveur Express.
- Tous les runs ci-dessous utilisent **10 questions demandées, difficulté medium**, sauf mention contraire.

| Date | Contexte | Prompt | Langue | Texte (c) | Q. dem. | Q. val. | Q. rej. | Motifs rejet | Durée (s) | Remarques |
|------|----------|--------|--------|-----------|--------|--------|--------|-------------|-----------|-----------|
| 2026-09-07 | LLM direct | — | fr | 4 427 | 10 | 0 | — | LLM impossible : `gemini-2.0-flash` retiré → HTTP 404 | — | Blocage total. Idem ar/en (non testés séparément). |
| 2026-09-07 | LLM direct | v1 | fr | 4 427 | 10 | 9 | 1 | `DUPLICATE_CHOICES` ×1 | ~25,0 | Ancrage ratio 1,00. Seul rejet = 2 propositions identiques (qualité modèle). |
| 2026-09-07 | LLM direct | v1 | ar | 3 501 | 10 | 10 | 0 | — | ~26,0 | Cours sans harakat → normalisation ancrage correcte. |
| 2026-09-07 | LLM direct | v1 | en | 4 779 | 10 | 10 | 0 | — | ~20,0 | — |
| 2026-09-08 | HTTP | v1 | fr | 4 427 | 10 | 10 | 0 | — | 17,6 (17 637 ms) | `gemini-3.5-flash`, repli auto depuis `gemini-2.0-flash`. |
| 2026-09-08 | HTTP | v1 | ar | 3 501 | 10 | 10 | 0 | — | 19,2 (19 151 ms) | Idem. |
| 2026-09-08 | HTTP | v1 | en | 4 779 | 10 | 10 | 0 | — | 21,7 (21 741 ms) | Idem. |
| n/d | n/d | v1 | fr | 4 427 | 10 | 10 | 0 | — | n/d | Run 1/6 — série répétitions variance, `gemini-3.5-flash`. |
| n/d | n/d | v1 | fr | 4 427 | 10 | 10 | 0 | — | n/d | Run 2/6 — idem. |
| n/d | n/d | v1 | fr | 4 427 | 10 | 10 | 0 | — | n/d | Run 3/6 — idem. |
| n/d | n/d | v1 | fr | 4 427 | 10 | 9 | 1 | `DUPLICATE_CHOICES` ×1 | n/d | Run 4/6 — idem. |
| n/d | n/d | v1 | fr | 4 427 | 10 | 10 | 0 | — | n/d | Run 5/6 — idem. |
| n/d | n/d | v1 | fr | 4 427 | 10 | 9 | 1 | `DUPLICATE_CHOICES` ×1 | n/d | Run 6/6 — idem. |
| 2026-09-22 | LLM direct | v2 | fr | 4 044 | 10 | 10 | 0 | — | 11,9 | Photo­synthèse, **easy**, `gemini-3.5-flash-lite`. Toutes valides. |
| 2026-09-22 | LLM direct | v2 | fr | 4 044 | 10 | 10 | 0 | — | 56,7 | Photo­synthèse, **medium**, `gemini-3.5-flash-lite`. |
| 2026-09-22 | LLM direct | v2 | fr | 4 044 | 10 | 9 | 1 | `EXCERPT_NOT_FOUND` ×1 | 68,2 | Photo­synthèse, **hard**, `gemini-3.5-flash-lite`. 1 rejet = extrait introuvable (combinaison de 2 passages). |
| 2026-09-22 | PDF (pdf.js) | — | ar | 0 (scanné) | — | — | — | PDF scanné : aucun texte | — | `svt-mounib.pdf` (2 679 Ko). pdf.js détecte < 50 c/page → avertissement, extraction impossible. Aucune génération. |
| 2026-09-22 | PDF (pdf.js) → LLM direct | v2 | fr | 8 801 | 5 | 0 | 5 | `SCHEMA_INVALID` ×5 | 107,5 | `chap2-numpy.pdf` (587 Ko, 16 p). Extraction pdf.js OK. Génération échoue : contenu code Python dense → LLM ne produit pas de JSON valide. `gemini-3.5-flash-lite`. |

---

## Mesures à compléter

Les lacunes suivantes rendent certaines statistiques de synthèse non calculables ou peu robustes.
Priorité suggérée entre parenthèses (H = haute / M = moyenne / B = basse).

### 1. Latence par tranche de texte — tranches incomplètes **(H)**

| Tranche | Mesures disponibles | Action requise |
|---------|-------------------|----------------|
| < 5 000 c | 9 mesures (3 LLM direct v1 + 3 HTTP v1 + 3 LLM direct v2 photo) | Suffisant |
| 5 000–15 000 c | 1 mesure partielle (PDF code, `SCHEMA_INVALID`) | Tester avec un **cours rédigé** de ~8 000 c |
| > 15 000 c | **0** | Tester avec un texte de ~25 000 c ; prévoir dépassement du seuil `hint_long` |

### 2. Variance des durées **(M)**

Les 6 runs de variance n'ont pas de durée enregistrée.
Il manque : date, durée (s), contexte (LLM direct ou HTTP), température utilisée.
Sans cela, l'écart-type de latence sur le même texte répété ne peut pas être calculé.

### 3. Tests prompt v2 — langues ar et en manquantes **(H)**

Les 3 runs fr (easy/medium/hard) sur photosynthèse sont faits (2026-09-22).
Il manque :

| Test à réaliser | Niveau | Langue | Critère de succès |
|----------------|--------|--------|-------------------|
| Cours arabe équivalent | easy/medium/hard | ar | Mêmes critères qu'en fr |
| Cours anglais équivalent | easy/medium/hard | en | Mêmes critères qu'en fr |

6 lignes supplémentaires attendues dans le tableau.

### 4. Tests PDF réel — comparaison à compléter **(M)**

Deux tests réalisés le 2026-09-22, aucun ne constitue une comparaison propre :
- `svt-mounib.pdf` (ar) : scanné → extraction impossible → hors périmètre.
- `chap2-numpy.pdf` (fr, text-layer) : extraction réussie (8 801 c), mais génération
  échoue sur contenu code Python (`SCHEMA_INVALID`). La baseline texte propre
  (cours-fr.txt, même run) a échoué sur congestion API (503/timeout).

**À faire :** relancer les deux runs (PDF code vs .txt propre) à API disponible,
**ET** tester un PDF de cours rédigé (non code) pour confirmer si `SCHEMA_INVALID`
est spécifique au code ou systématique sur tout PDF extrait.

### 5. Couverture arabe et anglais sur les 6 runs répétés **(B)**

La série de 6 runs répétés n'existe que pour le français.
Pour calculer σ(Q. valides) par langue, il faudrait 6 runs similaires en ar et en.

### 6. Impact de la difficulté sur le taux de rejet — données easy/hard désormais partielles **(M)**

Données v2 disponibles : easy 0 %, hard 10 % (`EXCERPT_NOT_FOUND`), medium n/d (v2).
Il manque : runs hard et easy en v1 pour comparaison avant/après, et runs medium en v2.
