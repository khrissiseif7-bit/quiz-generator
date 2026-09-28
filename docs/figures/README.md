# Figures du chapitre « Tests et évaluation »

Graphiques générés **uniquement** à partir des données réelles de `mesures.md`
(racine du projet). Aucune valeur inventée. Format : SVG autonome (aucune
dépendance, aucun CDN), largeur 800 px, pensé pour une insertion Word en
16 cm de large. Palette : `#317AC1` principal, `#384454` texte, `#D4D3DC`
grille, `#E1A624` mise en évidence, `#2E7D4F` / `#C0392B` valide / rejeté.

> Avertissement transversal : plusieurs séries de `mesures.md` ont été
> obtenues avec des **modèles différents** (`gemini-3.5-flash` vs
> `gemini-3.5-flash-lite`, et un ancien `gemini-2.0-flash` retiré). Les
> légendes ci-dessous précisent le modèle de chaque figure ; ne jamais
> comparer deux séries de modèles différents sur un même axe sans le signaler.

---

## fig-validite-langues.svg

**Légende proposée :** « Figure 5.1 — Taux de questions valides par langue
(français, arabe, anglais), prompt v1. Axe borné à 100 %. »

**Données utilisées** (section « Taux de questions valides par langue ») :

| Langue | Runs | Q. demandées | Q. valides | Taux valides |
|--------|------|--------------|-----------|--------------|
| fr | 8 (2 indiv. + 6 répétés) | 80 | 77 | 96,3 % |
| ar | 2 | 20 | 20 | 100,0 % |
| en | 2 | 20 | 20 | 100,0 % |

- Modèle : gemini-3.5-flash (post-correctif). Prompt v1.
- Le lot `fr` agrège LLM direct (2026-09-07) + HTTP (2026-09-08) + 6 runs
  répétés (dates n/d). Motif de rejet unique observé : `DUPLICATE_CHOICES`.

---

## fig-difficulte.svg

**Légende proposée :** « Figure 5.2 — Questions valides / rejetées par niveau de
difficulté (prompt v2), cours photosynthèse. Durées indicatives seulement (un
seul run par niveau, mesuré pendant une saturation de l'API) : elles ne
permettent pas de conclure à un effet du niveau sur la latence. »

**Données utilisées** (« Runs post-v2 réalisés le 2026-09-22 — cours
photosynthèse, 4 044 c, fr, 10 questions demandées ») :

| Niveau | Q. valides | Q. rejetées | Motif | Durée |
|--------|-----------|-------------|-------|-------|
| facile (easy) | 10 | 0 | — | 11,9 s |
| moyen (medium) | 10 | 0 | — | 56,7 s |
| difficile (hard) | 9 | 1 | `EXCERPT_NOT_FOUND` | 68,2 s |

- Modèle : gemini-3.5-flash-lite. Prompt v2. Date : 2026-09-22.
- Durées (11,9 / 56,7 / 68,2 s) **indicatives** : un seul run par niveau, mesuré
  pendant une période de saturation de l'API (erreurs 503). Ne pas en conclure
  un effet du niveau de difficulté sur la latence.

---

## fig-stabilite.svg

**Légende proposée :** « Figure 5.3 — Stabilité du générateur : questions
valides sur 6 exécutions répétées du même cours (cours-fr.txt). »

**Données utilisées** (« Variance sur runs répétés », cours-fr.txt = 4 427 c,
10 questions, prompt v1, gemini-3.5-flash) :

| Run | 1 | 2 | 3 | 4 | 5 | 6 |
|-----|---|---|---|---|---|---|
| Q. valides / 10 | 10 | 10 | 10 | 9 | 10 | 9 |

- Moyenne = **9,67** ; écart-type **σ = 0,47** question ; taux de rejet moyen
  3,3 % ; aucun `GENERATION_FAILED`.
- Motif des 2 rejets (runs 4 et 6) : `DUPLICATE_CHOICES`.
- Modèle : gemini-3.5-flash. Prompt v1. **Dates et durées des runs : n/d.**

---

## fig-motifs-rejet.svg

**Légende proposée :** « Figure 5.4 — Répartition de tous les rejets
enregistrés, par motif. Le cas SCHEMA_INVALID (PDF de code) est isolé car hors
périmètre d'un cours rédigé. »

**Données utilisées** (recensement de tous les rejets de la section « Données
brutes ») :

| Motif | Occurrences | Provenance | Modèle |
|-------|-------------|-----------|--------|
| `DUPLICATE_CHOICES` | 3 | fr, prompt v1 (1 run indiv. + runs 4 et 6) | gemini-3.5-flash |
| `EXCERPT_NOT_FOUND` | 1 | fr, prompt v2, niveau difficile (photosynthèse) | gemini-3.5-flash-lite |
| `SCHEMA_INVALID` | 5 | chap2-numpy.pdf (code Python dense) — **hors périmètre** | gemini-3.5-flash-lite |

- Total : **9 rejets**.
- Exclu du décompte : le blocage `gemini-2.0-flash` (HTTP 404, 2026-09-07) —
  aucune question n'a été générée, ce n'est donc pas un rejet de question.
- Exclu également : `svt-mounib.pdf` (PDF scanné) — extraction impossible,
  aucune génération.
- **Modèles et contextes différents** : ce graphique est un recensement, pas
  une comparaison contrôlée.

---

## Données manquantes signalées (non représentées, non inventées)

Ces éléments demandés indirectement ne sont PAS traçables faute de mesures :

- **Durées des 6 runs de stabilité** : `n/d` dans `mesures.md` (fig-stabilite
  ne montre donc que le nombre de valides, pas la variance de latence).
- **Prompt v2 en ar et en** : non mesuré → fig-difficulte reste sur le
  français uniquement.
- **Comparaison à modèle identique** : impossible entre séries
  gemini-3.5-flash et gemini-3.5-flash-lite ; signalé dans chaque légende.
