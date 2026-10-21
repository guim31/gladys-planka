// -----------------------------------------------------------------------------
// Planka API client: the calls the integration needs, on `/api`, for Planka
// 2.x. Checked against a real ghcr.io/plankanban/planka 2.2.1 in Docker,
// October 2026.
//
// Authentication, either:
//   - an API key (2.x, created by an administrator for a user), sent in the
//     `X-Api-Key` header: nothing else to do;
//   - a username (or e-mail) and password: `POST /api/access-tokens` gives a
//     JWT (valid one year), sent as `Authorization: Bearer`. It is kept in
//     memory and asked again on a 401.
//
//   POST  /api/access-tokens              { emailOrUsername, password } → { item: token }
//   GET   /api/projects                   { items: Project[], included: { boards } }
//   GET   /api/boards/:id                 { item: Board, included: { lists, cards, … } }
//   POST  /api/lists/:id/cards            { item: Card } (create)
//   PATCH /api/cards/:id                  { item: Card } (move, due completed)
//
// Pitfalls found on the real server:
//   - Ids are 64-bit integers written as strings ("1890957640519910408"):
//     beyond Number.MAX_SAFE_INTEGER, they are never parsed as numbers.
//   - The first login of a user answers 403 `step: "accept-terms"` until the
//     terms are accepted in the web app; a user with two-factor login answers
//     403 too. An API key goes around both.
//   - A card created or moved into an active list needs a `position` (422
//     "Position must be present" otherwise).
//   - `GET /api/boards/:id` returns the cards of the active and closed lists
//     only, not those of the archive and the trash.
//   - Outside `/api`, the web app answers its HTML page with a 200, any path.
// -----------------------------------------------------------------------------

import { httpRequest } from './http.js';

export const ERROR_KINDS = Object.freeze({
  UNREACHABLE: 'unreachable', // no answer: down, wrong address, firewall
  TLS: 'tls', // the certificate does not verify (self-signed without the option)
  AUTH: 'auth', // wrong API key, username or password
  TERMS: 'terms', // first login: the terms must be accepted in the web app
  TOTP: 'totp', // two-factor login: use an API key
  FORBIDDEN: 'forbidden', // the user may not do this (board viewer)
  NOT_FOUND: 'not_found', // the board, list or card is gone
  NOT_PLANKA: 'not_planka', // something answers, but not the Planka API
  REDIRECT: 'redirect', // HTTP redirected to HTTPS, or a login portal
  RATE_LIMIT: 'rate_limit', // 429: a reverse proxy's request limit
  HTTP: 'http', // any other unexpected answer
});

export class PlankaError extends Error {
  constructor(kind, message, status) {
    super(message);
    this.name = 'PlankaError';
    this.kind = kind;
    this.status = status;
  }
}

const TLS_CODES = new Set([
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'CERT_HAS_EXPIRED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
]);

function networkError(err) {
  if (TLS_CODES.has(err.code)) {
    return new PlankaError(ERROR_KINDS.TLS, `Certificate refused (${err.code})`);
  }
  return new PlankaError(ERROR_KINDS.UNREACHABLE, err.code ? `${err.code}` : err.message);
}

const id = (value) => encodeURIComponent(String(value));

export class PlankaClient {
  /**
   * @param {object} options
   * @param {string} options.url base URL, without trailing slash
   * @param {string} [options.apiKey] API key (preferred when given)
   * @param {string} [options.username] username or e-mail
   * @param {string} [options.password]
   * @param {boolean} [options.insecure] accept a self-signed certificate
   * @param {Function} [options.request] HTTP seam (src/planka/http.js)
   */
  constructor({ url, apiKey = '', username = '', password = '', insecure = false, request }) {
    this.url = url;
    this.apiKey = apiKey;
    this.username = username;
    this.password = password;
    this.insecure = insecure;
    this.request = request ?? httpRequest;
    /** The JWT of the password login, null until asked. */
    this.token = null;
    this.loggingIn = null;
  }

  async send(path, { method = 'GET', json, headers = {} } = {}) {
    let response;
    try {
      response = await this.request(`${this.url}/api${path}`, {
        method,
        json,
        insecure: this.insecure,
        headers,
      });
    } catch (err) {
      throw networkError(err);
    }
    const { status, body } = response;
    let parsed;
    let parsedOk = true;
    try {
      parsed = JSON.parse(body);
    } catch {
      parsedOk = false;
    }
    // The server's own message, short; it never echoes a secret.
    const said =
      parsedOk && typeof parsed?.message === 'string' ? ` ${parsed.message.slice(0, 200)}` : '';
    if (status === 429) {
      throw new PlankaError(ERROR_KINDS.RATE_LIMIT, 'HTTP 429', status);
    }
    if (status >= 300 && status < 400) {
      throw new PlankaError(ERROR_KINDS.REDIRECT, `HTTP ${status}`, status);
    }
    if (!parsedOk) {
      // The web app answers its HTML page on paths outside the API.
      throw new PlankaError(
        status === 200 || status === 404 ? ERROR_KINDS.NOT_PLANKA : ERROR_KINDS.HTTP,
        `HTTP ${status}, not JSON`,
        status,
      );
    }
    if (status === 401) {
      throw new PlankaError(ERROR_KINDS.AUTH, `HTTP 401${said}`, status);
    }
    if (status === 403) {
      const step = typeof parsed?.step === 'string' ? parsed.step : '';
      const kind =
        step === 'accept-terms'
          ? ERROR_KINDS.TERMS
          : /totp/i.test(`${step} ${said}`)
            ? ERROR_KINDS.TOTP
            : ERROR_KINDS.FORBIDDEN;
      throw new PlankaError(kind, `HTTP 403${said}`, status);
    }
    if (status === 404) {
      throw new PlankaError(ERROR_KINDS.NOT_FOUND, `HTTP 404${said}`, status);
    }
    if (status < 200 || status >= 300) {
      throw new PlankaError(ERROR_KINDS.HTTP, `HTTP ${status}${said}`, status);
    }
    return parsed;
  }

  /** The password login; one at a time. */
  login() {
    this.loggingIn ??= (async () => {
      try {
        const data = await this.send('/access-tokens', {
          method: 'POST',
          json: { emailOrUsername: this.username, password: this.password },
        });
        if (typeof data?.item !== 'string' || data.item === '') {
          throw new PlankaError(ERROR_KINDS.NOT_PLANKA, 'no token in /access-tokens', 200);
        }
        this.token = data.item;
        return this.token;
      } catch (err) {
        // A login refused for a wrong password or a missing route: never "not found".
        if (err instanceof PlankaError && err.kind === ERROR_KINDS.NOT_FOUND) {
          throw new PlankaError(ERROR_KINDS.NOT_PLANKA, 'no /api/access-tokens', 404);
        }
        throw err;
      } finally {
        this.loggingIn = null;
      }
    })();
    return this.loggingIn;
  }

  /** An authenticated call; a password session that expired logs in again, once. */
  async call(path, options = {}) {
    if (this.apiKey) {
      return this.send(path, { ...options, headers: { 'x-api-key': this.apiKey } });
    }
    const token = this.token ?? (await this.login());
    try {
      return await this.send(path, { ...options, headers: { authorization: `Bearer ${token}` } });
    } catch (err) {
      if (!(err instanceof PlankaError) || err.kind !== ERROR_KINDS.AUTH) {
        throw err;
      }
      if (this.token === token) {
        this.token = null;
      }
      const fresh = this.token ?? (await this.login());
      return this.send(path, { ...options, headers: { authorization: `Bearer ${fresh}` } });
    }
  }

  /** Projects and their boards the user sees. */
  async projects() {
    let data;
    try {
      data = await this.call('/projects');
    } catch (err) {
      // Another JSON API, or a path prefix missing from the address.
      if (err instanceof PlankaError && err.kind === ERROR_KINDS.NOT_FOUND) {
        throw new PlankaError(ERROR_KINDS.NOT_PLANKA, 'no /api/projects', 404);
      }
      throw err;
    }
    if (!data || !Array.isArray(data.items)) {
      throw new PlankaError(ERROR_KINDS.NOT_PLANKA, 'no items in /projects', 200);
    }
    return data;
  }

  /** A board with its lists and cards. */
  async board(boardId) {
    const data = await this.call(`/boards/${id(boardId)}`);
    if (!data?.item || !data.included) {
      throw new PlankaError(ERROR_KINDS.NOT_PLANKA, 'no board in /boards', 200);
    }
    return data;
  }

  /** Create a card in a list; `dueDate` an ISO string or omitted. */
  async createCard(listId, { name, position, dueDate }) {
    const json = { type: 'project', name, position };
    if (dueDate) {
      json.dueDate = dueDate;
    }
    const data = await this.call(`/lists/${id(listId)}/cards`, { method: 'POST', json });
    return data?.item ?? null;
  }

  /** Change some fields of a card (Planka's PATCH keeps the others). */
  async updateCard(cardId, fields) {
    const data = await this.call(`/cards/${id(cardId)}`, { method: 'PATCH', json: fields });
    return data?.item ?? null;
  }
}
