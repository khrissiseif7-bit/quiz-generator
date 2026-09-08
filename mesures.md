# Mesures des tests du générateur de quiz

Convention : **v1** = gabarit de prompt initial ; **v2** = gabarit après
correction du prompt. Ici, la cause du 502 était le **modèle retiré** (Cas A),
pas le prompt : une fois le modèle corrigé, le prompt v1 atteint déjà < 30 % de
rejets sur les trois langues. **Aucun v2 n'a donc été nécessaire.**

Modèle utilisé après correctif : `gemini-3.5-flash` (repli automatique depuis
`gemini-2.0-flash`, retiré). Difficulté `medium`, 10 questions demandées.
Durées = appel LLM + validation (banc d'essai direct, hors HTTP).

| Date | Version du prompt | Langue du cours | Questions demandées | Questions valides | Questions rejetées | Motifs de rejet | Durée | Remarques |
|------|-------------------|-----------------|---------------------|-------------------|--------------------|-----------------|-------|-----------|
| 2026-09-07 | — (avant correctif) | fr | 10 | 0 | — | Appel LLM impossible : `gemini-2.0-flash` retiré → HTTP 404 → 502 | — | Blocage total : aucune question générable avant le correctif de modèle. Idem ar/en. |
| 2026-09-07 | v1 | fr | 10 | 9 | 1 | `DUPLICATE_CHOICES` ×1 | ~25 s | Ancrage OK (ratio 1.00). Seul rejet = 2 propositions identiques (qualité modèle), pas d'ancrage. Taux de rejet 10 %. |
| 2026-09-07 | v1 | ar | 10 | 10 | 0 | — | ~26 s | Aucun rejet. Cours sans harakat → normalisation d'ancrage correcte. Taux 0 %. |
| 2026-09-07 | v1 | en | 10 | 10 | 0 | — | ~20 s | Aucun rejet. Taux 0 %. |
| 2026-09-08 | v1 | fr | 10 | 10 | 0 | — | 17637 ms | End-to-end via serveur HTTP (durée serveur, `meta.durationMs`). Modèle `gemini-3.5-flash`. Taux 0 %. |
| 2026-09-08 | v1 | ar | 10 | 10 | 0 | — | 19151 ms | End-to-end via serveur HTTP (durée serveur). Taux 0 %. |
| 2026-09-08 | v1 | en | 10 | 10 | 0 | — | 21741 ms | End-to-end via serveur HTTP (durée serveur). Taux 0 %. |

**Synthèse v1** (après correctif de modèle) : rejets fr 10 % / ar 0 % / en 0 %,
tous < 30 %. Objectif atteint sans modification de prompt.

**Variance** (fr, 6 générations répétées, `gemini-3.5-flash`, prompt v1) :
questions valides = 10, 10, 10, 9, 10, 9 → **moyenne 9,67/10** (≈ 3,3 % de rejet,
motif `DUPLICATE_CHOICES`). Pire cas 9/10 : aucun run sous les 60 % de
survivantes, donc aucun `GENERATION_FAILED` sur cet échantillon.

> Réserve : chaque ligne = **un seul appel** (sortie LLM non déterministe). Les
> chiffres peuvent varier d'un tirage à l'autre ; à confirmer sur plusieurs runs
> pour une moyenne robuste.
