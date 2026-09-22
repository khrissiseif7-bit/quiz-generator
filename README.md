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
- **pdf.js** (`pdfjs-dist` 4.7.76) — **vendoré** dans `public/vendor/pdfjs/`
  (`pdf.mjs` + `pdf.worker.mjs`) et chargé **localement** côté client par
  `PdfExtractor.js` (import dynamique + `GlobalWorkerOptions.workerSrc`). Aucun
  CDN au runtime ; hors dépendances serveur.

## Configuration

Le fichier `.env` vit dans **`server/`** (à côté de `server/.env.example`) :

```bash
cp server/.env.example server/.env   # puis compléter les valeurs
```

Renseigner : `PORT`, `ACCESS_CODE`, `LLM_PROVIDER`/`LLM_API_KEY`/`LLM_MODEL`,
les quotas (`RATE_LIMIT_PER_IP`, `RATE_LIMIT_PER_IP_DAY`, `DAILY_GLOBAL_LIMIT`)
et les limites de taille (`MAX_TEXT_LENGTH`, `MAX_BODY_BYTES`).

> **Chargement du `.env`** — `server.js` charge ce fichier avec un **chemin
> explicite** relatif au dossier `server/` :
> ```js
> dotenv.config({ path: path.join(__dirname, ".env") });
> ```
> Le `.env` est donc trouvé **quel que soit le répertoire de lancement** (racine
> du projet ou `server/`). En ESM, ce chargement précède un **import dynamique**
> du routeur, car certains modules (ex. `quota.service.js`) lisent `process.env`
> dès leur chargement : un import statique s'exécuterait trop tôt.
>
> Notes : `ACCESS_CODE` vide ⇒ contrôle du code d'accès désactivé (mode
> développement, avertissement au démarrage). `.env` est ignoré par git ;
> ne jamais le committer.

### Robustesse & diagnostic

- **Repli de modèle** : si `LLM_MODEL` est retiré (404) ou saturé (503), le
  service essaie automatiquement une liste de modèles Flash de repli et retient
  le premier qui répond (voir `MODELES_REPLI` dans `llm.service.js`).
- **Codes d'erreur distincts** : `LLM_UNAVAILABLE` (502) = échec réseau/API/modèle ;
  `GENERATION_FAILED` (502) = trop de questions rejetées à la validation (< 60 %
  de survivantes, après un second essai à température plus basse).
- **`DEBUG_LLM=true`** : logs de diagnostic (statut + corps des erreurs Gemini,
  JSON illisible, décompte et détail des rejets de validation). À laisser à
  `false` en usage normal.

## Démarrage

```bash
npm install
npm run dev      # node --watch server/server.js
# puis, dans un autre terminal, banc d'essai du prompt :
node scripts/test-generate.js test-data/cours-fr.txt
# et le banc d'essai du CRUD/persistance (base en mémoire, isolée) :
npm run test:crud
```

---

## Persistance & CRUD REST

> **PRINCIPE DIRECTEUR : on stocke le QUIZ, jamais le texte du cours.**
> L'enregistrement est une **action volontaire** de l'utilisateur, pas un
> automatisme. Le texte source n'est conservé que si l'utilisateur coche
> explicitement « conserver le texte » (colonne `courses.text`). Les quiz et
> questions ne portent aucun texte de cours : seulement sa **longueur**
> (`source_length`) et l'**extrait cité** (`source_excerpt`), déjà validé par
> ancrage. Ce principe est rappelé en commentaire dans `quiz.repository.js`.
>
> **Transmission ≠ stockage** : pour reconnaître un même document re-déposé, le
> texte est envoyé à `POST /courses` afin d'y calculer une **empreinte**
> (`SHA-256` du texte normalisé). Ce texte n'est **persisté** (`courses.text`)
> que si l'utilisateur a coché « conserver le texte » ; sinon il est utilisé le
> temps de la requête puis oublié. De plus, `GET /courses/:code` ne renvoie le
> champ `text` **qu'au propriétaire** (bonne `X-Owner-Key`).

### Base de données

- Moteur : **SQLite** via le module natif **`node:sqlite`** (Node 22+, **aucune
  dépendance à installer**). En cas d'indisponibilité, le serveur échoue au
  démarrage avec un message explicite (pas de bascule silencieuse).
- Fichier : `server/data/quiz.db` (dossier `server/data/` **ignoré par git**).
  Surchargeable par `DB_PATH` (`:memory:` pour les tests).
- Schéma : `server/db/schema.sql`, appliqué au démarrage
  (`CREATE TABLE IF NOT EXISTS`, `PRAGMA foreign_keys = ON`, suppressions en
  cascade). Connexion : `server/db/connection.js`.
- **Tout le SQL** vit dans `server/services/quiz.repository.js` (requêtes
  **préparées**, jamais de concaténation). La création d'un quiz (quiz +
  questions + flashcards) se fait dans une **transaction**.

### Schéma des tables

| Table | Colonnes principales |
|---|---|
| `courses` | `code` (PK), `title`, `text_hash` (UNIQUE), `text_length`, `text` (NULL sauf si conservé), `language`, `score`, `last_attempt_at`, `created_at`, `owner_key_hash` |
| `quizzes` | `code` (PK), `title`, `language`, `difficulty`, `question_count`, `source_length`, `created_at`, `owner_key_hash`, `course_code` (FK → courses, NULL) |
| `questions` | `id` (PK), `quiz_code` (FK), `position`, `question`, `choices` (JSON), `correct_index`, `explanation`, `source_excerpt`, `source_page`, `origin` (`ai`\|`manual`) |
| `flashcards` | `id` (PK), `quiz_code` (FK), `front`, `back`, `source_page` |
| `attempts` | `id` (PK), `quiz_code` (FK), `score`, `total`, `created_at` |

### Sécurité sans compte

- `code` : 6 caractères, alphabet sans ambiguïté (`security.service.js`).
- `ownerKey` : 32 caractères, renvoyée **une seule fois** à la création,
  stockée en **hash SHA-256**. Fournie via `X-Owner-Key` sur les écritures.
- `X-Owner-Key` requis sur `PUT`/`DELETE` d'un quiz, tout le CRUD des questions,
  `PUT`/`DELETE` d'un cours (`middlewares/ownerKey.js` → `403 FORBIDDEN`).
- `X-Access-Code` requis sur les **écritures** (POST/PUT/DELETE) et la génération ;
  **pas** sur les **lectures** (`GET /quizzes/:code`, `/quizzes/:code/stats`,
  `/courses/:code`), qui ne consomment aucun quota LLM et restent protégées par le
  code de la ressource (+ `X-Owner-Key` pour le texte d'un cours).
- `POST /quizzes` limité à **10/h par IP** (`quota.service.js`).

### Routes REST

| Méthode | Route | Clé prop. | Rôle |
|---|---|:--:|---|
| `POST` | `/quizzes` | — | crée un quiz → `201 { code, ownerKey }` |
| `GET` | `/quizzes/:code` | — | quiz complet (sans le hash) |
| `PUT` | `/quizzes/:code` | ✔ | modifie le titre |
| `DELETE` | `/quizzes/:code` | ✔ | supprime le quiz (cascade) |
| `POST` | `/quizzes/:code/questions` | ✔ | ajoute une question (`origin: manual`) |
| `PUT` | `/quizzes/:code/questions/:id` | ✔ | modifie une question |
| `DELETE` | `/quizzes/:code/questions/:id` | ✔ | supprime ; `409` s'il resterait < 3 |
| `POST` | `/quizzes/:code/attempts` | — | enregistre une tentative |
| `GET` | `/quizzes/:code/stats` | — | `{ attempts, averageScore, bestScore }` |
| `POST` | `/courses` | — | crée un cours (ou renvoie l'existant si même texte) |
| `GET` | `/courses/:code` | — | cours + quiz + tentatives + `score`/`displayedScore` |
| `PUT` | `/courses/:code` | ✔ | titre + stockage du texte on/off |
| `DELETE` | `/courses/:code` | ✔ | supprime cours + quiz + tentatives (cascade) |

Contrat complet : **[`docs/contract.md`](docs/contract.md)**.

> **Note d'implémentation (front)** : après enregistrement, chaque modification
> d'une question passe par l'API puis **re-`GET`** le quiz complet pour
> resynchroniser les ids réels des questions. C'est simple et toujours correct,
> mais optimisable : on pourrait mettre à jour l'état local à partir de la
> réponse de l'API (qui renvoie déjà la question créée/modifiée) et éviter cet
> aller-retour supplémentaire.

### Score de révision (courbe de l'oubli)

Service **pur** `server/services/score.service.js` :

- après chaque tentative : `score = 0.6 × (résultat%) + 0.4 × score_précédent`
  (première tentative : résultat brut) ;
- **score affiché** : `displayedScore = score × exp(-jours / 14)`, borné à 0.
  Le score **stocké** ne change pas avec le temps ; seule la valeur **affichée**
  décroît. `GET /courses/:code` renvoie les deux.

### Front — parcours et stockage local

- **Génération → « Vérifier les questions » → quiz** : après génération, un écran
  d'édition (`EditView`/`EditController`) permet de relire, corriger, ajouter ou
  supprimer des questions (CRUD **en mémoire** tant que le quiz n'est pas
  enregistré ; **via l'API** ensuite). Un quiz garde toujours au moins 3 questions.
- **Enregistrement** : « Enregistrer ce quiz » (`POST /quizzes`) affiche le code
  et la **clé propriétaire** (à conserver, jamais réaffichée). Si « Rattacher à
  mes cours » est coché, un cours est créé/retrouvé par empreinte et le quiz y
  est rattaché ; « Conserver le texte » décide du stockage de `courses.text`.
- **Recommandation** du nombre de questions : heuristique client instantanée
  (`SettingsModel.recommendCount`), le sélecteur affiche « N (recommandé) ».
- **Ouvrir par code** (accueil) : sans clé → le quiz se joue ; avec clé → édition.
- **Onglet « Mes cours »** : liste des cours connus de CE navigateur, **anneau de
  score coloré** (rouge < 50, ambre 50-79, vert ≥ 80), détail avec **courbe SVG**
  des scores et historique, révision directe (si le texte est conservé) ou
  invitation à re-déposer le document (reconnu par empreinte).
- **Fin de quiz** : si le quiz est enregistré, la tentative est envoyée **en
  silence** (`POST /attempts`) et les statistiques (nombre de tentatives, moyenne,
  meilleur) s'affichent sous le score.

> **`localStorage`** — pour la persistance **durable** entre sessions : sous la
> clé `quiz-generator:courses`, on ne conserve QUE des identifiants et clés de
> cours (`{ code, ownerKey, title, language }`) — **jamais** le texte d'un cours
> ni un quiz. Géré uniquement par `public/js/services/CourseStore.js`.
>
> **`sessionStorage`** — pour la durée de la **session de navigation** : le
> **code d'accès** y est conservé (clé `quiz-generator:accessCode`) afin de ne
> pas le ressaisir après un rechargement ; il est effacé à la fermeture de
> l'onglet. Seul usage de sessionStorage (`SettingsModel`). Ce sont les deux
> seuls stockages navigateur de l'application.
