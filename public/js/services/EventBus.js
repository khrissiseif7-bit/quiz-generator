/**
 * EventBus.js — Bus d'événements publish/subscribe.
 *
 * COUCHE : Service transverse.
 * RÔLE : découpler les couches. C'est le canal par lequel Model -> View
 * communique (jamais d'appel direct). Views et Controllers publient des
 * intentions ; Models et Views s'y abonnent.
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
