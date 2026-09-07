Squelette complet et validé. Tout est en place, aucune logique métier sauf EventBus.js (syntaxe vérifiée avec node --check).

Ce qui a été livré

32 fichiers créés, exactement selon l'arborescence demandée :

- Front (public/) — index.html (3 écrans sémantiques upload/quiz/résultat, data-i18n, [hidden]), style.css (variables, reset, [dir="rtl"]), app.js (composition root) ; 3 models, 4 views, 2 controllers, 6 services.
- Back (server/) — server.js, route, controller, 3 services, 2 middlewares, 3 gabarits de prompt (fr/ar/en), .env.example.
- Docs — docs/contract.md, README.md, package.json.

Points d'architecture couverts

- Chaque fichier porte en en-tête sa couche et les règles qui le concernent : Models sans DOM, Views sans logique métier, Controllers seuls à appeler les Services, Model→View via EventBus.
- Chaque fonction = signature + JSDoc (entrées/sorties) + // TODO décrivant le rôle. Rien n'est implémenté…
- …sauf EventBus.js (subscribe/publish, ~40 lignes avec JSDoc, le seul demandé).
- Contrat figé dans docs/contract.md (source de vérité), répété en commentaire dans Validator.js et validation.service.js, avec la règle anti-hallucination (source_excerpt réellement présent dans le texte) et les codes 401/413/429/502 rattachés à leur couche.
- Provider LLM isolé derrière une interface (LlmProvider + createProvider) dans llm.service.js.
- README : arborescence commentée, rôle de chaque couche, 5 invariants, et le flux d'une requête en 9 étapes de bout en bout.

Non fait (comme demandé)

- Aucun npm install — dépendances seulement listées dans package.json (express, dotenv ; SDK provider et pdf.js documentés comme à venir).
- Aucun commit git effectué.

Tu peux valider l'architecture. Quand tu veux, je te guide pour le premier commit (à la main, selon ta préférence) ou on passe à l'implémentation d'une couche.
/**
 * EventBus.js — Bus d'événements publish/subscribe.
 *
 * COUCHE : Service transverse.
 * RÔLE : découpler les couches. C'est le canal par lequel Model -> View
 * communique (jamais d'appel direct). Views et Controllers publient des
 * intentions ; Models et Views s'y abonnent.
 *
 * NB : c'est le SEUL service réellement implémenté à cette étape.
 */
export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} Table event -> ensemble de handlers. */
    this._handlers = new Map();
  }

  /**
   * Abonne un handler à un événement.
   * @param {string} event - Nom de l'événement.
   * @param {Function} handler - Fonction appelée avec le payload publié.
   * @returns {() => void} Fonction de désabonnement.
   */
  subscribe(event, handler) {
    if (!this._handlers.has(event)) {
      this._handlers.set(event, new Set());
    }
    this._handlers.get(event).add(handler);
    return () => this._handlers.get(event)?.delete(handler);
  }

  /**
   * Publie un événement à tous ses abonnés.
   * @param {string} event - Nom de l'événement.
   * @param {*} [payload] - Donnée transmise aux handlers.
   * @returns {void}
   */
  publish(event, payload) {
    const handlers = this._handlers.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      handler(payload);
    }
  }
}
