# Générateur de Quiz

Application pédagogique qui génère un quiz (QCM + flashcards) à partir d'un
cours fourni en **PDF** ou en **texte collé**. Front en **HTML/CSS/JS vanilla**
(imposé), back **Node.js + Express** minimal. **Aucune base de données, aucune
persistance.** Architecture **MVC stricte** à des fins pédagogiques.

> État actuel : **squelette validé**. Les fichiers contiennent leurs signatures,
> leur JSDoc et des `// TODO`. Seul `EventBus.js` est réellement implémenté.

---

## Arborescence

```
quiz-generator/
├── docs/
│   └── contract.md              # Contrat d'échange front↔back (SOURCE DE VÉRITÉ)
├── public/                      # FRONT (servi en statique par Express)
│   ├── index.html               # 3 écrans : upload / quiz / résultat
│   ├── css/
│   │   └── style.css            # variables CSS, reset, support [dir="rtl"]
│   └── js/
│       ├── app.js               # point d'entrée : câble models/views/controllers
│       ├── models/              # état pur, jamais de DOM
│       │   ├── DocumentModel.js  # texte source, pages, langue détectée
│       │   ├── QuizModel.js      # questions, index courant, réponses, score
│       │   └── SettingsModel.js  # langue, difficulté, nombre de questions
│       ├── views/               # DOM uniquement, aucune logique métier
│       │   ├── UploadView.js
│       │   ├── QuizView.js
│       │   ├── FlashcardView.js
│       │   └── ResultView.js
│       ├── controllers/         # seuls à appeler les services
│       │   ├── UploadController.js
│       │   └── QuizController.js
│       └── services/
│           ├── EventBus.js       # publish/subscribe (IMPLÉMENTÉ)
│           ├── PdfExtractor.js    # pdf.js : PDF -> {text, pages[]}
│           ├── ApiClient.js       # POST /generate-quiz, timeout, 401/413/429/502
│           ├── Validator.js       # validation client du JSON reçu
│           ├── LanguageDetector.js# fr / ar / en
│           └── I18n.js            # dictionnaire fr/ar/en, bascule dir=rtl
├── server/                      # BACK
│   ├── server.js                # démarrage Express
│   ├── routes/
│   │   └── quiz.routes.js
│   ├── controllers/
│   │   └── quiz.controller.js
│   ├── services/
│   │   ├── llm.service.js        # prompt + appel provider (isolé derrière interface)
│   │   ├── validation.service.js # schéma strict + source_excerpt réellement présent
│   │   └── quota.service.js      # rate limit par IP + compteur global journalier
│   ├── middlewares/
│   │   ├── accessCode.js         # code d'accès en variable d'environnement
│   │   └── limits.js             # taille du body, longueur du texte
│   ├── config/
│   │   └── prompts/              # un gabarit par langue
│   │       ├── fr.js
│   │       ├── ar.js
│   │       └── en.js
│   └── .env.example
├── package.json
└── README.md
```

---

## Rôle de chaque couche

### Front (MVC)

- **Models** — détiennent l'état (document, quiz, réglages) et la **logique métier**
  (ex. calcul du score dans `QuizModel`). Ils **ne touchent jamais au DOM** et
  notifient leurs changements **via l'EventBus**.
- **Views** — lisent/écrivent **uniquement le DOM**. **Aucune logique métier**
  (ni score, ni validation, ni appel de service). Elles émettent des intentions
  utilisateur sur le bus et réagissent aux événements des Models.
- **Controllers** — orchestrent. Ce sont les **seuls à appeler les Services**.
  Ils écoutent les intentions UI, invoquent les services, mettent à jour les
  Models (qui, à leur tour, notifient les Views via le bus).
- **Services** — briques techniques réutilisables : extraction PDF, appel API,
  validation, détection de langue, i18n, et le bus d'événements.

### Back (MVC serveur)

- **Routes** — enchaînent middlewares puis délèguent au controller. Aucune logique.
- **Controllers** — orchestrent les services (quota → LLM → validation) et
  formatent la réponse/erreur.
- **Services** — logique réelle : construction du prompt et appel LLM
  (`llm.service`, provider **isolé derrière une interface**), validation stricte
  anti-hallucination (`validation.service`), quotas en mémoire (`quota.service`).
- **Middlewares** — contrôles transverses : code d'accès, limites de taille.

### Règles d'architecture (invariants)

1. Les **Models** ne touchent **jamais** au DOM.
2. Les **Views** ne contiennent **aucune** logique métier.
3. Les **Controllers** sont les **seuls** à appeler les **Services**.
4. **Model → View** passe **toujours** par l'**EventBus**, jamais en direct.
5. Le **format d'échange** front↔back est **figé** dans `docs/contract.md` :
   aucune couche ne doit le contredire (rappelé dans `Validator.js` et
   `validation.service.js`).

---

## Flux d'une requête de bout en bout

1. **Upload** — l'utilisateur colle du texte ou dépose un PDF.
   `UploadView` émet une intention sur le bus.
2. **Extraction** — `UploadController` appelle `PdfExtractor` (si PDF) →
   `{ text, pages[] }`, alimente `DocumentModel`, et détecte la langue via
   `LanguageDetector` (préremplit `SettingsModel` + bascule `I18n`).
3. **Génération** — au clic « Générer », `UploadController` lit `DocumentModel`
   + `SettingsModel` et appelle `ApiClient.generateQuiz(payload, accessCode)`
   → `POST /generate-quiz` (en-tête `X-Access-Code`, timeout).
4. **Back : middlewares** — `accessCode` (→ 401) puis `limits` (→ 413).
5. **Back : controller** — `quota.service` (→ 429), puis `llm.service` construit
   le prompt selon la langue (`config/prompts/*`) et appelle le **provider isolé**
   (→ 502 en cas d'échec).
6. **Back : validation** — `validation.service` vérifie le schéma **et** que
   chaque `source_excerpt` existe réellement dans le texte source (anti-hallucination ;
   sinon 502). Réponse **conforme au contrat** renvoyée.
7. **Front : validation client** — `ApiClient` mappe les codes d'erreur ;
   `Validator` revérifie le JSON. En cas de succès, `UploadController` appelle
   `QuizModel.load(quiz)`.
8. **Quiz** — `QuizModel` publie `quiz:loaded` → `QuizView` / `FlashcardView`
   s'affichent. `QuizController` gère réponses et navigation (le Model calcule).
9. **Résultat** — à « Terminer », `QuizController` déclenche
   `QuizModel.computeScore()` → `ResultView` affiche score et récapitulatif.

---

## Contrat d'échange

Le format de `POST /generate-quiz` (requête, réponse, codes 401/413/429/502) est
défini dans **[`docs/contract.md`](docs/contract.md)**. C'est la source de vérité.

---

## Dépendances prévues (non installées)

Déclarées dans `package.json`, à installer à l'étape d'implémentation :

- **express** — serveur HTTP et routage.
- **dotenv** — chargement des variables d'environnement (`server/.env`).
- **SDK provider LLM** (ex. `openai` ou `@anthropic-ai/sdk`) — ajouté avec
  `llm.service.js`.
- **pdf.js** (`pdfjs-dist`) — chargé **côté client** dans `PdfExtractor.js`
  (via module/CDN), donc hors dépendances serveur.

## Configuration

Copier `server/.env.example` en `server/.env` et renseigner : `PORT`,
`ACCESS_CODE`, `LLM_PROVIDER`/`LLM_API_KEY`/`LLM_MODEL`, quotas et limites de taille.

## Démarrage (à venir)

```bash
npm install      # à l'étape d'implémentation
npm run dev      # node --watch server/server.js
```
